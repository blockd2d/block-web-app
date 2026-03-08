import { create } from "zustand";
import { getApiBase, setApiAuth, api } from "../lib/apiClient";
import {
  getStoredRefreshToken,
  setStoredTokens,
  clearStoredTokens,
  clearStoredSession
} from "../lib/storage";

export type AuthStatus =
  | "idle"
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "boot_error";

/** User shape from Block API (e.g. GET /v1/auth/me, login response). */
export type User = {
  id: string;
  org_id?: string;
  role?: string;
  name?: string | null;
  email?: string | null;
  org_name?: string | null;
};

export type AuthMode = "real" | "mock";

/** Mock user for Mock View (session-only demo). PRD: Marcus Hill, Labor, Nova Crew A. */
export const MOCK_USER: User = {
  id: "mock-user-1",
  name: "Marcus Hill",
  email: "mock.labor@block.local",
  role: "labor",
  org_name: "Nova Crew A"
};

type AuthState = {
  status: AuthStatus;
  authMode: AuthMode;
  accessToken: string | null;
  user: User | null;
  error: string | null;
  isLabor: boolean;

  bootstrap(): Promise<void>;
  continueToLogin(): void;
  enterMockView(): void;
  exitMockView(): void;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  setError(message: string | null): void;
};

export function isMockMode(): boolean {
  return useAuthStore.getState().authMode === "mock";
}

async function loginWithApi(email: string, password: string): Promise<{
  user: User;
  session: { access_token: string; refresh_token: string; expires_in?: number };
}> {
  const base = getApiBase();
  const res = await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-block-client": "mobile"
    },
    body: JSON.stringify({ email, password, turnstileToken: "" })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data?.error ?? data?.message ?? "Invalid credentials") as string;
    throw new Error(msg);
  }
  if (!data.session?.access_token || !data.session?.refresh_token || !data.user) {
    throw new Error("Invalid login response");
  }
  return {
    user: data.user as User,
    session: data.session as { access_token: string; refresh_token: string; expires_in?: number }
  };
}

async function refreshWithApi(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in?: number;
} | null> {
  const base = getApiBase();
  const res = await fetch(`${base}/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-block-client": "mobile"
    },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  const session = data.session ?? data;
  if (!session?.access_token || !session?.refresh_token) return null;
  return session as { access_token: string; refresh_token: string; expires_in?: number };
}

export const useAuthStore = create<AuthState>((set, get) => {
  function clearSession() {
    set({
      status: "unauthenticated",
      accessToken: null,
      user: null,
      error: null
    });
    clearStoredTokens();
    clearStoredSession();
  }

  async function doRefresh(): Promise<boolean> {
    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) return false;
    const session = await refreshWithApi(refreshToken);
    if (!session) return false;
    await setStoredTokens(session.access_token, session.refresh_token);
    set({ accessToken: session.access_token });
    return true;
  }

  setApiAuth(
    () => get().accessToken,
    clearSession,
    doRefresh
  );

  return {
    status: "idle",
    authMode: "real",
    accessToken: null,
    user: null,
    error: null,
    isLabor: true,

    setError: (message) => set({ error: message }),

    continueToLogin: () =>
      set({
        status: "unauthenticated",
        accessToken: null,
        user: null,
        error: null
      }),

    enterMockView: () =>
      set({
        authMode: "mock",
        status: "authenticated",
        user: MOCK_USER,
        accessToken: null,
        error: null,
        isLabor: true
      }),

    exitMockView: () => {
      clearStoredTokens();
      clearStoredSession();
      set({
        authMode: "real",
        status: "unauthenticated",
        accessToken: null,
        user: null,
        error: null
      });
    },

    bootstrap: async () => {
      set({ status: "loading", error: null });
      try {
        const refreshToken = await getStoredRefreshToken();
        if (!refreshToken) {
          set({
            status: "unauthenticated",
            accessToken: null,
            user: null,
            error: null
          });
          return;
        }
        const session = await refreshWithApi(refreshToken);
        if (!session) {
          await clearStoredTokens();
          set({
            status: "unauthenticated",
            accessToken: null,
            user: null,
            error: null
          });
          return;
        }
        await setStoredTokens(session.access_token, session.refresh_token);
        set({ accessToken: session.access_token });

        const meData = await api.get("/v1/auth/me") as { user?: User };
        const user = meData?.user ?? null;
        if (!user?.id) {
          await clearStoredTokens();
          set({
            status: "unauthenticated",
            accessToken: null,
            user: null,
            error: null
          });
          return;
        }
        set({
          status: "authenticated",
          user,
          error: null,
          isLabor: true
        });
      } catch (e) {
        const msg = (e as Error)?.message ?? "Boot failed";
        set({
          status: "boot_error",
          accessToken: null,
          user: null,
          error: msg
        });
      }
    },

    login: async (email: string, password: string) => {
      set({ status: "loading", error: null });
      try {
        const { user, session } = await loginWithApi(email, password);
        await setStoredTokens(session.access_token, session.refresh_token);
        set({
          status: "authenticated",
          accessToken: session.access_token,
          user,
          error: null,
          isLabor: true
        });
      } catch (e) {
        const msg = (e as Error)?.message ?? "Sign in failed";
        set({
          status: "unauthenticated",
          accessToken: null,
          user: null,
          error: msg
        });
        throw e;
      }
    },

    logout: async () => {
      set({ status: "loading" });
      try {
        await api.post("/v1/auth/logout");
      } catch {
        // ignore
      }
      await clearStoredTokens();
      clearSession();
    }
  };
});
