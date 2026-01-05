/**
 * Supabase Edge Function: twilio-send-sms (TEMPLATE)
 * Expects JSON: { to: string, body: string, from?: string }
 * Uses secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { to, body, from } = await req.json();
    if (!to || !body) {
      return new Response(JSON.stringify({ error: "to and body required" }), { status: 400, headers: { ...corsHeaders, "Content-Type":"application/json" } });
    }
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const token = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const fromNum = from || Deno.env.get("TWILIO_FROM_NUMBER")!;
    if (!sid || !token || !fromNum) {
      return new Response(JSON.stringify({ error: "Twilio secrets not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type":"application/json" } });
    }

    const auth = btoa(`${sid}:${token}`);
    const form = new URLSearchParams();
    form.set("To", to);
    form.set("From", fromNum);
    form.set("Body", body);

    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const data = await resp.json();
    return new Response(JSON.stringify({ ok: resp.ok, data }), { status: resp.ok ? 200 : 400, headers: { ...corsHeaders, "Content-Type":"application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type":"application/json" } });
  }
});
