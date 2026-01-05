import {supabase} from './supabase';
import {Message} from '../types';

export class TwilioService {
  private static instance: TwilioService;

  static getInstance(): TwilioService {
    if (!TwilioService.instance) {
      TwilioService.instance = new TwilioService();
    }
    return TwilioService.instance;
  }

  async sendMessage(
    propertyId: string,
    toNumber: string,
    message: string,
  ): Promise<Message> {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('User not authenticated');

      const response = await supabase.functions.invoke('send-sms', {
        body: {
          to: toNumber,
          message,
          propertyId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const messageRecord: Omit<Message, 'id' | 'created_at' | 'updated_at'> = {
        property_id: propertyId,
        rep_id: user.id,
        twilio_sid: response.data.sid,
        from_number: response.data.from,
        to_number: toNumber,
        body: message,
        direction: 'outbound',
        status: 'sent',
      };

      const {data, error} = await supabase
        .from('messages')
        .insert(messageRecord)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('[Twilio] Error sending message:', error);
      throw error;
    }
  }

  async getMessages(propertyId: string): Promise<Message[]> {
    try {
      const {data, error} = await supabase
        .from('messages')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', {ascending: true});

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Twilio] Error fetching messages:', error);
      throw error;
    }
  }

  async receiveWebhook(payload: any): Promise<void> {
    try {
      const messageRecord: Omit<Message, 'id' | 'created_at' | 'updated_at'> = {
        property_id: payload.propertyId || '',
        rep_id: payload.repId || '',
        twilio_sid: payload.MessageSid,
        from_number: payload.From,
        to_number: payload.To,
        body: payload.Body,
        direction: 'inbound',
        status: 'received',
      };

      const {error} = await supabase.from('messages').insert(messageRecord);
      if (error) throw error;

      // Send push notification to rep
      await this.notifyRepOfMessage(messageRecord);
    } catch (error) {
      console.error('[Twilio] Error processing webhook:', error);
      throw error;
    }
  }

  private async notifyRepOfMessage(message: Omit<Message, 'id' | 'created_at' | 'updated_at'>) {
    // Implementation would integrate with push notification service
    console.log('[Twilio] Notifying rep of new message:', message);
  }
}

export const twilioService = TwilioService.getInstance();