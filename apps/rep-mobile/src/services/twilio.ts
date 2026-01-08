import { blockApi } from './blockApi';
import { Message, MessageThread } from '../types';

export class TwilioService {
  private static instance: TwilioService;

  static getInstance(): TwilioService {
    if (!TwilioService.instance) {
      TwilioService.instance = new TwilioService();
    }
    return TwilioService.instance;
  }

  async sendMessage(propertyId: string, toNumber: string, message: string): Promise<Message> {
    const res = await blockApi.post('/v1/messages/send', {
      to: toNumber,
      body: message,
      property_id: propertyId
    });
    return res.message as Message;
  }

  async getThreads(propertyId?: string): Promise<MessageThread[]> {
    const qs = propertyId ? `?property_id=${encodeURIComponent(propertyId)}` : '';
    const res = await blockApi.get(`/v1/messages/threads${qs}`);
    return (res.threads ?? []) as MessageThread[];
  }

  async getThreadMessages(threadId: string): Promise<{ thread: MessageThread; messages: Message[] }> {
    const res = await blockApi.get(`/v1/messages/threads/${threadId}`);
    return { thread: res.thread as MessageThread, messages: (res.messages ?? []) as Message[] };
  }
}

export const twilioService = TwilioService.getInstance();
