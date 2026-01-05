/**
 * Supabase Edge Function: twilio-inbound (TEMPLATE)
 * Twilio webhook target for inbound SMS.
 * Configure Twilio to POST form-encoded payloads here.
 * In v1 this just returns 200; extend to insert messages into DB.
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Twilio sends application/x-www-form-urlencoded by default
  const ct = req.headers.get("content-type") || "";
  let payload: Record<string, string> = {};
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    for (const [k, v] of params.entries()) payload[k] = v;
  } else {
    try { payload = await req.json(); } catch {}
  }

  // TODO: insert into supabase table (messages) using service role key (server-side)
  return new Response(JSON.stringify({ ok: true, received: payload }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
