import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from './supabase';
import {OfflineQueueItem} from '../types';
import {Interaction, Sale, FollowUp, RepLocation} from '../types';

const OFFLINE_QUEUE_KEY = 'offline_queue';
const SYNC_BATCH_SIZE = 50;

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
    // Listen for network changes
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;

      if (!wasOnline && this.isOnline) {
        // Came back online, trigger sync
        this.syncOfflineData();
      }
    });

    // Initial network check
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected && state.isInternetReachable;

    // Start periodic sync
    setInterval(() => {
      if (this.isOnline) {
        this.syncOfflineData();
      }
    }, 30000); // Every 30 seconds
  }

  async queueItem(type: OfflineQueueItem['type'], data: any): Promise<string> {
    const item: OfflineQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: new Date().toISOString(),
      synced: false,
      retry_count: 0,
    };

    const queue = await this.getQueue();
    queue.push(item);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

    // Try to sync immediately if online
    if (this.isOnline) {
      this.syncOfflineData();
    }

    return item.id;
  }

  private async getQueue(): Promise<OfflineQueueItem[]> {
    try {
      const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
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
      const unsyncedItems = queue.filter(item => !item.synced);

      if (unsyncedItems.length === 0) {
        this.syncInProgress = false;
        return;
      }

      console.log(`[OfflineSync] Syncing ${unsyncedItems.length} items`);

      // Process in batches
      for (let i = 0; i < unsyncedItems.length; i += SYNC_BATCH_SIZE) {
        const batch = unsyncedItems.slice(i, i + SYNC_BATCH_SIZE);
        await this.processBatch(batch);
      }

      console.log('[OfflineSync] Sync completed');
    } catch (error) {
      console.error('[OfflineSync] Sync error:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async processBatch(batch: OfflineQueueItem[]) {
    await Promise.all(
      batch.map(item => this.syncItem(item)),
    );
  }

  private async syncItem(item: OfflineQueueItem): Promise<boolean> {
    try {
      let result;

      switch (item.type) {
        case 'interaction':
          result = await this.syncInteraction(item.data as Interaction);
          break;
        case 'sale':
          result = await this.syncSale(item.data as Sale);
          break;
        case 'follow_up':
          result = await this.syncFollowUp(item.data as FollowUp);
          break;
        case 'location_update':
          result = await this.syncLocationUpdate(item.data as RepLocation);
          break;
        default:
          console.warn(`[OfflineSync] Unknown item type: ${item.type}`);
          return false;
      }

      if (result) {
        // Mark as synced
        const queue = await this.getQueue();
        const index = queue.findIndex(q => q.id === item.id);
        if (index !== -1) {
          queue[index].synced = true;
          await this.saveQueue(queue);
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error(`[OfflineSync] Error syncing item ${item.id}:`, error);
      
      // Increment retry count
      const queue = await this.getQueue();
      const index = queue.findIndex(q => q.id === item.id);
      if (index !== -1) {
        queue[index].retry_count++;
        queue[index].last_error = error instanceof Error ? error.message : String(error);
        await this.saveQueue(queue);
      }

      return false;
    }
  }

  private async syncInteraction(data: Interaction): Promise<boolean> {
    const {error} = await supabase.from('interactions').insert(data);
    if (error) throw error;
    return true;
  }

  private async syncSale(data: Sale): Promise<boolean> {
    const {error} = await supabase.from('sales').insert(data);
    if (error) throw error;
    return true;
  }

  private async syncFollowUp(data: FollowUp): Promise<boolean> {
    const {error} = await supabase.from('followups').insert(data);
    if (error) throw error;
    return true;
  }

  private async syncLocationUpdate(data: RepLocation): Promise<boolean> {
    const {error} = await supabase.from('rep_locations').insert(data);
    if (error) throw error;
    return true;
  }

  async clearSyncedItems() {
    const queue = await this.getQueue();
    const unsyncedItems = queue.filter(item => !item.synced);
    await this.saveQueue(unsyncedItems);
  }

  async getUnsyncedCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.filter(item => !item.synced).length;
  }
}

export const offlineSyncService = OfflineSyncService.getInstance();