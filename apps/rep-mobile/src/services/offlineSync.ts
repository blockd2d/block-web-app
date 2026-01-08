import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineQueueItem, Interaction, Sale, FollowUp, RepLocation } from '../types';
import { blockApi } from './blockApi';

const OFFLINE_QUEUE_KEY = 'offline_queue';
const SYNC_BATCH_SIZE = 25;

export class OfflineSyncService {
  private static instance: OfflineSyncService;
  private isOnline = false;
  private syncInProgress = false;

  static getInstance(): OfflineSyncService {
    if (!OfflineSyncService.instance) {
      OfflineSyncService.instance = new OfflineSyncService();
    }
    return OfflineSyncService.instance;
  }

  async initialize() {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = !!state.isConnected && !!state.isInternetReachable;
      if (!wasOnline && this.isOnline) {
        this.syncOfflineData().catch(() => null);
      }
    });

    const state = await NetInfo.fetch();
    this.isOnline = !!state.isConnected && !!state.isInternetReachable;

    setInterval(() => {
      if (this.isOnline) this.syncOfflineData().catch(() => null);
    }, 30_000);
  }

  async queueItem(type: OfflineQueueItem['type'], data: any): Promise<string> {
    const item: OfflineQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: new Date().toISOString(),
      synced: false,
      retry_count: 0
    };

    const queue = await this.getQueue();
    queue.push(item);
    await this.saveQueue(queue);

    if (this.isOnline) this.syncOfflineData().catch(() => null);
    return item.id;
  }

  private async getQueue(): Promise<OfflineQueueItem[]> {
    try {
      const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      return data ? (JSON.parse(data) as OfflineQueueItem[]) : [];
    } catch (error) {
      console.error('[OfflineSync] Error reading queue:', error);
      return [];
    }
  }

  private async saveQueue(queue: OfflineQueueItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('[OfflineSync] Error saving queue:', error);
    }
  }

  async syncOfflineData() {
    if (this.syncInProgress || !this.isOnline) return;

    this.syncInProgress = true;
    try {
      const queue = await this.getQueue();
      const unsynced = queue.filter(i => !i.synced);
      if (unsynced.length === 0) return;

      for (let i = 0; i < unsynced.length; i += SYNC_BATCH_SIZE) {
        const batch = unsynced.slice(i, i + SYNC_BATCH_SIZE);
        await Promise.all(batch.map(item => this.syncItem(item)));
      }
    } catch (error) {
      console.error('[OfflineSync] Sync error:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async markSynced(itemId: string) {
    const queue = await this.getQueue();
    const idx = queue.findIndex(q => q.id === itemId);
    if (idx !== -1) {
      queue[idx].synced = true;
      await this.saveQueue(queue);
    }
  }

  private async markFailed(itemId: string, error: unknown) {
    const queue = await this.getQueue();
    const idx = queue.findIndex(q => q.id === itemId);
    if (idx !== -1) {
      queue[idx].retry_count += 1;
      queue[idx].last_error = error instanceof Error ? error.message : String(error);
      await this.saveQueue(queue);
    }
  }

  private async syncItem(item: OfflineQueueItem): Promise<boolean> {
    try {
      switch (item.type) {
        case 'interaction':
          await this.syncInteraction(item.data as Interaction);
          break;
        case 'sale':
          await this.syncSale(item.data as Sale);
          break;
        case 'follow_up':
          await this.syncFollowUp(item.data as FollowUp);
          break;
        case 'location_update':
          await this.syncLocationUpdate(item.data as RepLocation);
          break;
        default:
          console.warn('[OfflineSync] Unknown item type:', item.type);
          return false;
      }
      await this.markSynced(item.id);
      return true;
    } catch (error) {
      await this.markFailed(item.id, error);
      return false;
    }
  }

  private async syncInteraction(data: Interaction): Promise<void> {
    await blockApi.post('/v1/interactions', {
      property_id: data.property_id,
      outcome: data.outcome,
      notes: data.notes,
      followup_at: data.followup_at
    });
  }

  private async syncSale(data: Sale): Promise<void> {
    await blockApi.post('/v1/sales', {
      property_id: data.property_id,
      price: data.price,
      service_type: data.service_type,
      notes: data.notes,
      customer_phone: data.customer_phone,
      customer_email: data.customer_email,
      status: data.status
    });
  }

  private async syncFollowUp(data: FollowUp): Promise<void> {
    await blockApi.post('/v1/followups', {
      property_id: data.property_id,
      due_at: data.due_at,
      status: data.status,
      notes: data.notes
    });
  }

  private async syncLocationUpdate(data: RepLocation): Promise<void> {
    await blockApi.post('/v1/reps/me/location', data);
  }

  async clearSyncedItems() {
    const queue = await this.getQueue();
    await this.saveQueue(queue.filter(i => !i.synced));
  }

  async getUnsyncedCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.filter(i => !i.synced).length;
  }
}

export const offlineSyncService = OfflineSyncService.getInstance();
