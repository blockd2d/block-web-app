import { supabaseAdmin } from "./supabase.js";
import { v4 as uuidv4 } from "uuid";

export async function enqueueJob(orgId: string, kind: string, params: any) {
  const id = uuidv4();
  const { error } = await supabaseAdmin.from("jobs_queue").insert({
    id,
    org_id: orgId,
    kind,
    params,
    status: "queued",
    progress: 0,
  });
  if (error) throw error;
  return id;
}
