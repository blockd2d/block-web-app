import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';

export type QueueItem =
  | {
      id: string;
      type: 'job_start';
      created_at: number;
      payload: { job_id: string };
    }
  | {
      id: string;
      type: 'job_complete';
      created_at: number;
      payload: { job_id: string; completion_notes?: string; upcharge_notes?: string };
    }
  | {
      id: string;
      type: 'job_photo';
      created_at: number;
      payload: { job_id: string; kind: string; filename?: string; data_url: string };
    };

const KEY = 'offline_queue_v1';

async function readQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueueItem[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueueItem[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export const offlineQueue = {
  async list() {
    return readQueue();
  },
  async enqueue(item: QueueItem) {
    const q = await readQueue();
    q.push(item);
    await writeQueue(q);
  },
  async clear() {
    await writeQueue([]);
  },
  async flush(opts?: { max?: number }) {
    const max = opts?.max ?? 25;
    const q = await readQueue();
    if (q.length === 0) return { ok: true, processed: 0, remaining: 0 };

    const remaining: QueueItem[] = [];
    let processed = 0;

    for (const item of q) {
      if (processed >= max) {
        remaining.push(item);
        continue;
      }

      try {
        if (item.type === 'job_start') {
          await api.startJob(item.payload.job_id);
        } else if (item.type === 'job_complete') {
          await api.completeJob(item.payload.job_id, {
            completion_notes: item.payload.completion_notes,
            upcharge_notes: item.payload.upcharge_notes
          });
        } else if (item.type === 'job_photo') {
          await api.uploadJobPhoto(item.payload.job_id, {
            kind: item.payload.kind,
            filename: item.payload.filename,
            data_url: item.payload.data_url
          });
        }
        processed++;
      } catch {
        remaining.push(item);
      }
    }

    await writeQueue(remaining);
    return { ok: true, processed, remaining: remaining.length };
  }
};
