import {serve} from 'https://deno.land/std@0.168.0/http/server.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: corsHeaders});
  }

  try {
    // Create Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_KEY') ?? '',
      {auth: {persistSession: false}}
    );

    // Parse Twilio webhook payload
    const formData = await req.formData();
    const twilioData = Object.fromEntries(formData.entries());

    console.log('Received Twilio webhook:', twilioData);

    // Extract relevant data
    const {
      MessageSid,
      From,
      To,
      Body,
      NumMedia,
      MediaUrl0,
      MediaContentType0,
    } = twilioData;

    if (!MessageSid || !From || !To || !Body) {
      throw new Error('Missing required fields from Twilio webhook');
    }

    // Find the property and rep associated with this conversation
    // This assumes you have a way to link phone numbers to properties/reps
    // You might need to adjust this logic based on your specific requirements

    const {data: messages, error: lookupError} = await supabaseClient
      .from('messages')
      .select('property_id, rep_id')
      .or(`from_number.eq.${From},to_number.eq.${From}`)
      .limit(1);

    let propertyId = null;
    let repId = null;

    if (messages && messages.length > 0) {
      // Found existing conversation
      propertyId = messages[0].property_id;
      repId = messages[0].rep_id;
    } else {
      // New conversation - you might want to handle this differently
      // For now, we'll log it and skip storing
      console.log('New conversation from unknown number:', From);
      
      // Return success to Twilio even if we don't store the message
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          headers: {'Content-Type': 'application/xml'},
          status: 200,
        }
      );
    }

    // Store incoming message
    const {error: dbError} = await supabaseClient
      .from('messages')
      .insert({
        property_id: propertyId,
        rep_id: repId,
        twilio_sid: MessageSid,
        from_number: From,
        to_number: To,
        body: Body,
        direction: 'inbound',
        status: 'received',
      });

    if (dbError) {
      console.error('Error storing message:', dbError);
      // Don't throw here - we want to return success to Twilio
    }

    // Handle media if present
    if (NumMedia && parseInt(NumMedia) > 0) {
      for (let i = 0; i < parseInt(NumMedia); i++) {
        const mediaUrl = twilioData[`MediaUrl${i}`];
        const mediaType = twilioData[`MediaContentType${i}`];
        
        if (mediaUrl) {
          console.log(`Received media: ${mediaUrl} (${mediaType})`);
          // You might want to download and store the media
          // This would require additional implementation
        }
      }
    }

    // Send push notification to rep (if configured)
    if (repId) {
      const {data: profile, error: profileError} = await supabaseClient
        .from('profiles')
        .select('push_token')
        .eq('id', repId)
        .single();

      if (profile?.push_token) {
        // Here you would send a push notification
        // Implementation depends on your push notification service
        console.log('Would send push notification to:', profile.push_token);
      }
    }

    // Return empty response to Twilio (no further action needed)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: {'Content-Type': 'application/xml'},
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error processing SMS webhook:', error);
    
    // Return error to Twilio (it will retry)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Sorry, there was an error processing your message.</Message></Response>',
      {
        headers: {'Content-Type': 'application/xml'},
        status: 500,
      }
    );
  }
});

/*
To deploy this function:

1. Deploy: supabase functions deploy receive-sms

2. Configure Twilio webhook:
   - Go to your Twilio Console
   - Navigate to Phone Numbers > Manage > Active numbers
   - Click on your number
   - In the "Messaging" section, set the webhook URL to:
     https://your-project.supabase.co/functions/v1/receive-sms
   - Set HTTP method to POST

3. Required environment variables:
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY

Note: This function must be publicly accessible (no authentication)
because Twilio cannot authenticate with JWT tokens.
*/