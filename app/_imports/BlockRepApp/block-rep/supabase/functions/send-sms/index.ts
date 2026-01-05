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
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {auth: {persistSession: false}}
    );

    // Get authenticated user
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      throw new Error('No authorization token provided');
    }

    const {data: {user}, error: userError} = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    // Parse request body
    const {to, message, propertyId} = await req.json();
    
    if (!to || !message) {
      throw new Error('Missing required fields: to, message');
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(to)) {
      throw new Error('Invalid phone number format');
    }

    // Get Twilio credentials from Supabase secrets
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio credentials not configured');
    }

    // Send SMS via Twilio
    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: to,
          Body: message,
        }).toString(),
      }
    );

    if (!twilioResponse.ok) {
      const errorData = await twilioResponse.text();
      throw new Error(`Twilio API error: ${errorData}`);
    }

    const messageData = await twilioResponse.json();

    // Store message in database
    const {error: dbError} = await supabaseClient
      .from('messages')
      .insert({
        property_id: propertyId,
        rep_id: user.id,
        twilio_sid: messageData.sid,
        from_number: fromNumber,
        to_number: to,
        body: message,
        direction: 'outbound',
        status: 'sent',
      });

    if (dbError) {
      console.error('Error storing message:', dbError);
      // Don't throw here - message was sent successfully
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Message sent successfully',
        data: {
          sid: messageData.sid,
          status: messageData.status,
        },
      }),
      {
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error sending SMS:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
        status: 400,
      }
    );
  }
});

/*
To deploy this function:

1. Install Supabase CLI: npm install -g supabase
2. Login: supabase login
3. Link project: supabase link --project-ref your-project-ref
4. Deploy: supabase functions deploy send-sms

Required environment variables in Supabase:
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN  
- TWILIO_PHONE_NUMBER
- SUPABASE_URL
- SUPABASE_ANON_KEY

Example request:
curl -X POST https://your-project.supabase.co/functions/v1/send-sms \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "to": "+1234567890",
    "message": "Hello from Block Rep!",
    "propertyId": "property-uuid"
  }'
*/