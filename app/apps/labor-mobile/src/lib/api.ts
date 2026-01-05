import { env } from "../env";
import { supabase } from "./supabase";

export async function authedPost(path: string, body: any) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(env.RAILWAY_API_BASE_URL + path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}
