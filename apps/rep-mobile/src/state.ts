import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Network from "expo-network";

import type { Me, Role, KnockLog, KnockOutcome, Quote, QuoteStatus, SyncState } from "./types";
import { api, type StoredSession } from "./lib/api";
import { config } from "./lib/runtimeConfig";
import { clearSalesLocalCaches } from "./lib/storage";

const SECURE_SESSION_KEY = "novasales.session";

/** ===== UI (online/offline + app active) ===== */
type UIState = {
  isOnline: boolean;
  isActive: boolean;
  setIsOnline(v: boolean): void;
  setIsActive(v: boolean): void;
};

export const useUIStore = create<UIState>((set) => ({
  isOnline: true,
  isActive: true,
  setIsOnline: (v) =>
    set((s) => {
      if (s.isOnline === v) return s;
      return { isOnline: v };
    }),
  setIsActive: (v) =>
    set((s) => {
      if (s.isActive === v) return s;
      return { isActive: v };
    })
}));

/** ===== Session ===== */
export type SessionStatus = "idle" | "loading" | "boot_error" | "authenticated" | "unauthenticated" | "unsupported_role";

type BootPhase =
  | "idle"
  | "reading_session"
  | "checking_network"
  | "restoring_session"
  | "verifying_me"
  | "routing_login"
  | "routing_main"
  | "error";

type BootLogItem = { at: number; message: string };

type SessionState = {
  status: SessionStatus;
  session: StoredSession | null;
  me: Me | null;
  authError: string | null;
  unsupportedRole: Role | null;

  bootPhase: BootPhase;
  bootMessage: string;
  bootError: string | null;
  bootLog: BootLogItem[];

  bootstrap(): Promise<void>;
  continueToLogin(message?: string): Promise<void>;

  login(email: string, password: string): Promise<void>;
  logout(reason?: string): Promise<void>;
};

function now() {
  return Date.now();
}

function pushLog(prev: BootLogItem[], message: string) {
  return [...prev, { at: now(), message }].slice(-10);
}

function roleIsSupported(role: Role) {
  return role === "rep" || role === "manager" || role === "admin";
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: "idle",
  session: null,
  me: null,
  authError: null,
  unsupportedRole: null,

  bootPhase: "idle",
  bootMessage: "Starting…",
  bootError: null,
  bootLog: [],

  continueToLogin: async (message) => {
    set({
      status: "unauthenticated",
      session: null,
      me: null,
      authError: message ?? null,
      unsupportedRole: null,
      bootPhase: "idle",
      bootMessage: "Ready",
      bootError: null
    });
  },

  bootstrap: async () => {
    set({
      status: "loading",
      authError: null,
      bootPhase: "reading_session",
      bootMessage: "Reading saved session…",
      bootError: null,
      bootLog: pushLog([], "Reading saved session…")
    });

    try {
      const raw = await SecureStore.getItemAsync(SECURE_SESSION_KEY);
      if (!raw) {
        set({ status: "unauthenticated", session: null, me: null, unsupportedRole: null, bootPhase: "routing_login", bootMessage: "No saved session. Routing to Login…" });
        return;
      }

      const stored = JSON.parse(raw) as StoredSession;
      set({ session: stored, bootPhase: "checking_network", bootMessage: "Checking network…", bootLog: pushLog(get().bootLog, "Checking network…") });

      let online = true;
      try {
        const ns = await Network.getNetworkStateAsync();
        online = !!ns.isConnected && ns.isInternetReachable !== false;
      } catch {
        online = useUIStore.getState().isOnline;
      }
      useUIStore.getState().setIsOnline(online);

      if (!config.mockMode && !online) {
        set({ status: "boot_error", bootPhase: "error", bootError: "You appear to be offline. We can’t verify your session right now." });
        return;
      }

      if (!config.mockMode) {
        set({ bootPhase: "restoring_session", bootMessage: "Restoring session…", bootLog: pushLog(get().bootLog, "Restoring session…") });
        await api.restoreSession(stored);
      }

      set({ bootPhase: "verifying_me", bootMessage: "Loading account…", bootLog: pushLog(get().bootLog, "Loading account…") });
      const me = await api.me({ access_token: stored.access_token });

      if (!roleIsSupported(me.role)) {
        await SecureStore.deleteItemAsync(SECURE_SESSION_KEY);
        await resetSalesLocalData();
        try {
          await api.signOut();
        } catch {
          // ignore
        }

        set({
          status: "unsupported_role",
          session: null,
          me,
          authError: "This account is not supported in the Nova Sales app.",
          unsupportedRole: me.role,
          bootPhase: "routing_login",
          bootMessage: "Unsupported role. Review account and return to Login.",
          bootLog: pushLog(get().bootLog, "Unsupported role. Showing account guidance.")
        });
        return;
      }

      set({ status: "authenticated", me, unsupportedRole: null, bootPhase: "routing_main", bootMessage: "Done. Routing to the app…", bootLog: pushLog(get().bootLog, "Done. Routing to the app…") });
    } catch (e) {
      const msg = (e as Error)?.message ?? "Boot failed";
      set({ status: "boot_error", bootPhase: "error", bootError: msg, bootMessage: msg, bootLog: pushLog(get().bootLog, msg) });
    }
  },

  login: async (email, password) => {
    set({ status: "loading", authError: null, unsupportedRole: null });
    try {
      const { session, me } = await api.signIn(email, password);

      if (!roleIsSupported(me.role)) {
        try {
          await api.signOut();
        } catch {
          // ignore
        }
        await SecureStore.deleteItemAsync(SECURE_SESSION_KEY);
        await resetSalesLocalData();
        set({
          status: "unsupported_role",
          session: null,
          me,
          authError: "This account is not supported in the Nova Sales app.",
          unsupportedRole: me.role
        });
        return;
      }

      await resetSalesLocalData();
      await SecureStore.setItemAsync(SECURE_SESSION_KEY, JSON.stringify(session));
      set({ status: "authenticated", session, me, authError: null, unsupportedRole: null });
    } catch (e) {
      const msg = (e as Error)?.message ?? "Login failed";
      set({ status: "unauthenticated", authError: msg, unsupportedRole: null });
    }
  },

  logout: async (reason) => {
    try {
      await api.signOut();
    } catch {
      // ignore
    }
    await SecureStore.deleteItemAsync(SECURE_SESSION_KEY);
    await resetSalesLocalData();
    set({ status: "unauthenticated", session: null, me: null, authError: reason ?? null, unsupportedRole: null });
  }
}));

/** ===== Stop Activity / local sync surfaces ===== */
export type StopActivity = {
  stopId: string;
  clusterId: string;
  lastOutcome: KnockOutcome | null;
  lastNotes: string | null;
  lastKnockAt: string | null;
  knockSyncState: SyncState | null;
  knockError: string | null;
  lastPhoneNumber: string | null;
  lastPhoneSavedAt: string | null;
  lastQuoteStatus: QuoteStatus | null;
  lastQuoteUpdatedAt: string | null;
  quoteSyncState: SyncState | null;
  quoteError: string | null;
  updatedAt: number;
};

type StopActivityState = {
  byStopId: Record<string, StopActivity>;
  recordKnockPending(payload: { stopId: string; clusterId: string; outcome: KnockOutcome; notes?: string | null }): void;
  recordKnockSyncing(payload: { stopId: string; clusterId: string; outcome?: KnockOutcome | null; notes?: string | null }): void;
  recordKnockSynced(log: KnockLog): void;
  recordKnockFailed(payload: { stopId: string; clusterId: string; outcome?: KnockOutcome | null; notes?: string | null }, error: string): void;
  savePhoneNumber(payload: { stopId: string; clusterId: string; phone: string }): void;
  recordQuotePending(payload: { stopId: string; clusterId: string; status: QuoteStatus }): void;
  recordQuoteSyncing(payload: { stopId: string; clusterId: string; status?: QuoteStatus | null }): void;
  recordQuoteSynced(quote: Quote): void;
  recordQuoteFailed(payload: { stopId: string; clusterId: string; status?: QuoteStatus | null }, error: string): void;
  clearStop(stopId: string): void;
};

function baseActivity(stopId: string, clusterId: string): StopActivity {
  return {
    stopId,
    clusterId,
    lastOutcome: null,
    lastNotes: null,
    lastKnockAt: null,
    knockSyncState: null,
    knockError: null,
    lastPhoneNumber: null,
    lastPhoneSavedAt: null,
    lastQuoteStatus: null,
    lastQuoteUpdatedAt: null,
    quoteSyncState: null,
    quoteError: null,
    updatedAt: Date.now()
  };
}

function upsertActivity(
  byStopId: Record<string, StopActivity>,
  stopId: string,
  clusterId: string,
  patch: Partial<StopActivity>
) {
  const prev = byStopId[stopId] ?? baseActivity(stopId, clusterId);
  return {
    ...byStopId,
    [stopId]: {
      ...prev,
      clusterId: prev.clusterId || clusterId,
      ...patch,
      updatedAt: Date.now()
    }
  };
}

export const useStopActivityStore = create<StopActivityState>()(
  persist(
    (set) => ({
      byStopId: {},
      recordKnockPending: (payload) =>
        set((s) => ({
          byStopId: upsertActivity(s.byStopId, payload.stopId, payload.clusterId, {
            lastOutcome: payload.outcome,
            lastNotes: payload.notes ?? null,
            lastKnockAt: new Date().toISOString(),
            knockSyncState: "pending",
            knockError: null
          })
        })),
      recordKnockSyncing: (payload) =>
        set((s) => ({
          byStopId: upsertActivity(s.byStopId, payload.stopId, payload.clusterId, {
            lastOutcome: payload.outcome ?? s.byStopId[payload.stopId]?.lastOutcome ?? null,
            lastNotes: payload.notes ?? s.byStopId[payload.stopId]?.lastNotes ?? null,
            knockSyncState: "syncing",
            knockError: null
          })
        })),
      recordKnockSynced: (log) =>
        set((s) => ({
          byStopId: upsertActivity(s.byStopId, log.stopId, log.clusterId, {
            lastOutcome: log.outcome,
            lastNotes: log.notes ?? null,
            lastKnockAt: log.createdAt,
            knockSyncState: "synced",
            knockError: null
          })
        })),
      recordKnockFailed: (payload, error) =>
        set((s) => ({
          byStopId: upsertActivity(s.byStopId, payload.stopId, payload.clusterId, {
            lastOutcome: payload.outcome ?? s.byStopId[payload.stopId]?.lastOutcome ?? null,
            lastNotes: payload.notes ?? s.byStopId[payload.stopId]?.lastNotes ?? null,
            knockSyncState: "failed",
            knockError: error
          })
        })),
      savePhoneNumber: (payload) =>
        set((s) => ({
          byStopId: upsertActivity(s.byStopId, payload.stopId, payload.clusterId, {
            lastPhoneNumber: payload.phone,
            lastPhoneSavedAt: new Date().toISOString()
          })
        })),
      recordQuotePending: (payload) =>
        set((s) => ({
          byStopId: upsertActivity(s.byStopId, payload.stopId, payload.clusterId, {
            lastQuoteStatus: payload.status,
            lastQuoteUpdatedAt: new Date().toISOString(),
            quoteSyncState: "pending",
            quoteError: null
          })
        })),
      recordQuoteSyncing: (payload) =>
        set((s) => ({
          byStopId: upsertActivity(s.byStopId, payload.stopId, payload.clusterId, {
            lastQuoteStatus: payload.status ?? s.byStopId[payload.stopId]?.lastQuoteStatus ?? null,
            quoteSyncState: "syncing",
            quoteError: null
          })
        })),
      recordQuoteSynced: (quote) =>
        set((s) => ({
          byStopId: upsertActivity(s.byStopId, quote.stopId, quote.clusterId, {
            lastQuoteStatus: quote.status,
            lastQuoteUpdatedAt: quote.updatedAt,
            quoteSyncState: "synced",
            quoteError: null
          })
        })),
      recordQuoteFailed: (payload, error) =>
        set((s) => ({
          byStopId: upsertActivity(s.byStopId, payload.stopId, payload.clusterId, {
            lastQuoteStatus: payload.status ?? s.byStopId[payload.stopId]?.lastQuoteStatus ?? null,
            quoteSyncState: "failed",
            quoteError: error
          })
        })),
      clearStop: (stopId) =>
        set((s) => {
          const next = { ...s.byStopId };
          delete next[stopId];
          return { byStopId: next };
        })
    }),
    {
      name: "novasales:stop-activity",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ byStopId: s.byStopId })
    }
  )
);

/** ===== Offline Queue ===== */
export type QueueType = "knock_log" | "upsert_quote";
export type QueueFlushReason = "app_active" | "network_online" | "manual" | "periodic" | "enqueue_online";

export type QueueItem = {
  id: string;
  type: QueueType;
  payload: any;
  createdAt: number;
  retries: number;
  lastError: string | null;
  nextAttemptAt: number;
};

function uid() {
  return `q_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function computeBackoffMs(retries: number, rand: () => number = Math.random) {
  const base = 1000;
  const max = 5 * 60 * 1000;
  const exp = Math.min(max, base * Math.pow(2, retries));
  const jitter = 0.2 + rand() * 0.3;
  return Math.floor(exp * (1 + jitter));
}

export function enqueuePure(items: QueueItem[], item: QueueItem): QueueItem[] {
  return [...items, item].sort((a, b) => a.createdAt - b.createdAt);
}
export function markRetryPure(items: QueueItem[], id: string, err: string, nowMs: number, rand?: () => number): QueueItem[] {
  return items.map((it) => {
    if (it.id !== id) return it;
    const retries = it.retries + 1;
    const delay = computeBackoffMs(retries, rand ?? Math.random);
    return { ...it, retries, lastError: err, nextAttemptAt: nowMs + delay };
  });
}
export function removePure(items: QueueItem[], id: string): QueueItem[] {
  return items.filter((it) => it.id !== id);
}
export function nextRunnablePure(items: QueueItem[], nowMs: number): QueueItem | null {
  const sorted = [...items].sort((a, b) => a.createdAt - b.createdAt);
  for (const it of sorted) {
    if (it.nextAttemptAt <= nowMs) return it;
  }
  return null;
}

type QueueState = {
  items: QueueItem[];
  flushing: boolean;
  lastFlushError: string | null;
  lastFlushAt: number | null;
  lastSuccessfulFlushAt: number | null;
  lastFlushReason: QueueFlushReason | null;

  enqueue(type: QueueType, payload: any): void;
  flush(reason: QueueFlushReason): Promise<void>;
  remove(id: string): void;
  clear(): void;
};

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      items: [],
      flushing: false,
      lastFlushError: null,
      lastFlushAt: null,
      lastSuccessfulFlushAt: null,
      lastFlushReason: null,

      enqueue: (type, payload) => {
        const nowMs = Date.now();
        const item: QueueItem = {
          id: uid(),
          type,
          payload,
          createdAt: nowMs,
          retries: 0,
          lastError: null,
          nextAttemptAt: nowMs
        };

        if (type === "knock_log") {
          useStopActivityStore.getState().recordKnockPending(payload);
        } else if (type === "upsert_quote") {
          useStopActivityStore.getState().recordQuotePending(payload);
        }

        set((s) => ({ items: enqueuePure(s.items, item) }));

        const ui = useUIStore.getState();
        const session = useSessionStore.getState();
        if (ui.isOnline && session.status === "authenticated") {
          setTimeout(() => {
            get().flush("enqueue_online").catch(() => {});
          }, 0);
        }
      },

      remove: (id) => set((s) => ({ items: removePure(s.items, id) })),

      clear: () => set({ items: [], lastFlushError: null }),

      flush: async (reason) => {
        if (get().flushing) return;

        const ui = useUIStore.getState();
        if (!ui.isOnline) return;

        set({ flushing: true, lastFlushError: null, lastFlushAt: Date.now(), lastFlushReason: reason });
        try {
          const session = useSessionStore.getState();
          if (session.status !== "authenticated") {
            set({ flushing: false });
            return;
          }

          let guard = 0;
          let progressed = false;
          while (guard++ < 50) {
            const next = nextRunnablePure(get().items, Date.now());
            if (!next) break;

            markItemSyncing(next);
            try {
              const result = await processQueueItem(next);
              progressed = true;
              markItemSynced(result);
              set((s) => ({ items: removePure(s.items, next.id) }));
            } catch (e) {
              const msg = (e as Error)?.message ?? "Queue item failed";
              markItemFailed(next, msg);
              set((s) => ({ items: markRetryPure(s.items, next.id, msg, Date.now()) }));
              set({ lastFlushError: msg });
              break;
            }
          }

          if (progressed) {
            set({ lastSuccessfulFlushAt: Date.now() });
          }
        } catch (e) {
          const msg = (e as Error)?.message ?? "Flush failed";
          set({ lastFlushError: msg });
        } finally {
          set({ flushing: false });
        }
      }
    }),
    {
      name: "novasales:queue",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ items: s.items })
    }
  )
);

/** ===== Walking Session (Resume) ===== */
export type WalkingSession = {
  clusterId: string;
  currentStopId: string | null;
  currentIndex: number;
  updatedAt: number;
};

type WalkingState = {
  sessions: Record<string, WalkingSession>;
  setSession(clusterId: string, patch: Partial<Omit<WalkingSession, "clusterId">>): void;
  clearSession(clusterId: string): void;
};

export const useWalkingStore = create<WalkingState>()(
  persist(
    (set, get) => ({
      sessions: {},
      setSession: (clusterId, patch) => {
        const prev = get().sessions[clusterId] ?? {
          clusterId,
          currentStopId: null,
          currentIndex: 0,
          updatedAt: Date.now()
        };
        const nextSession = {
          ...prev,
          ...patch
        };
        if (
          prev.currentStopId === nextSession.currentStopId &&
          prev.currentIndex === nextSession.currentIndex
        ) {
          return;
        }
        set((s) => ({
          sessions: {
            ...s.sessions,
            [clusterId]: {
              ...nextSession,
              updatedAt: Date.now()
            }
          }
        }));
      },
      clearSession: (clusterId) =>
        set((s) => {
          const next = { ...s.sessions };
          delete next[clusterId];
          return { sessions: next };
        })
    }),
    {
      name: "novasales:walking",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ sessions: s.sessions })
    }
  )
);

async function resetSalesLocalData(): Promise<void> {
  useQueueStore.setState({
    items: [],
    flushing: false,
    lastFlushError: null,
    lastFlushAt: null,
    lastSuccessfulFlushAt: null,
    lastFlushReason: null
  });
  useWalkingStore.setState({ sessions: {} });
  useStopActivityStore.setState({ byStopId: {} });

  await AsyncStorage.multiRemove([
    "novasales:queue",
    "novasales:walking",
    "novasales:stop-activity"
  ]);
  await clearSalesLocalCaches();
}

type QueueProcessResult =
  | { kind: "knock_log"; data: KnockLog }
  | { kind: "upsert_quote"; data: Quote };

function markItemSyncing(item: QueueItem) {
  switch (item.type) {
    case "knock_log":
      useStopActivityStore.getState().recordKnockSyncing(item.payload);
      return;
    case "upsert_quote":
      useStopActivityStore.getState().recordQuoteSyncing(item.payload);
      return;
  }
}

function markItemFailed(item: QueueItem, error: string) {
  switch (item.type) {
    case "knock_log":
      useStopActivityStore.getState().recordKnockFailed(item.payload, error);
      return;
    case "upsert_quote":
      useStopActivityStore.getState().recordQuoteFailed(item.payload, error);
      return;
  }
}

function markItemSynced(result: QueueProcessResult) {
  switch (result.kind) {
    case "knock_log":
      useStopActivityStore.getState().recordKnockSynced(result.data);
      return;
    case "upsert_quote":
      useStopActivityStore.getState().recordQuoteSynced(result.data);
      return;
  }
}

async function processQueueItem(item: QueueItem): Promise<QueueProcessResult> {
  switch (item.type) {
    case "knock_log": {
      const log = await api.createKnockLog(item.payload as Omit<KnockLog, "id" | "createdAt">);
      return { kind: "knock_log", data: log };
    }
    case "upsert_quote": {
      const quote = await api.upsertQuote(item.payload as any as Omit<Quote, "id" | "updatedAt" | "totalCents">);
      return { kind: "upsert_quote", data: quote };
    }
    default:
      throw new Error("Unknown queue type");
  }
}
