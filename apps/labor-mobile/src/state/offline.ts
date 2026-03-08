import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type QueuedActionType =
  | "job_status_update"
  | "checklist_update"
  | "job_note_create"
  | "issue_report_create"
  | "clock_event_create"
  | "photo_upload"
  | "attachment_metadata_create";

export type QueuedAction = {
  id: string;
  type: QueuedActionType;
  payload: Record<string, unknown>;
  created_at: string;
  retry_count: number;
  sync_status: "pending" | "syncing" | "done" | "failed";
};

type OfflineState = {
  queue: QueuedAction[];
  addAction(type: QueuedActionType, payload: Record<string, unknown>): void;
  removeAction(id: string): void;
  setActionStatus(id: string, status: QueuedAction["sync_status"]): void;
  incrementRetry(id: string): void;
  getPending(): QueuedAction[];
  clearDone(): void;
};

function makeId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set): OfflineState => ({
      queue: [],

      addAction: (type, payload) =>
        set((s: OfflineState) => ({
          queue: [
            ...s.queue,
            {
              id: makeId(),
              type,
              payload,
              created_at: new Date().toISOString(),
              retry_count: 0,
              sync_status: "pending"
            }
          ]
        })),

      removeAction: (id) =>
        set((s: OfflineState) => ({ queue: s.queue.filter((a) => a.id !== id) })),

      setActionStatus: (id, sync_status) =>
        set((s: OfflineState) => ({
          queue: s.queue.map((a) => (a.id === id ? { ...a, sync_status } : a))
        })),

      incrementRetry: (id) =>
        set((s: OfflineState) => ({
          queue: s.queue.map((a) =>
            a.id === id ? { ...a, retry_count: a.retry_count + 1 } : a
          )
        })),

      getPending: (): QueuedAction[] => {
        const state = useOfflineStore.getState();
        return state.queue.filter((a: QueuedAction) => a.sync_status === "pending");
      },

      clearDone: () =>
        set((s: OfflineState) => ({ queue: s.queue.filter((a) => a.sync_status !== "done") }))
    }),
    {
      name: "blocklabor-offline-queue",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s: OfflineState) => ({ queue: s.queue })
    }
  )
);
