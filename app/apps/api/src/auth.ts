import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

type JwtClaims = { sub: string; email?: string };

function b64urlToJson(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const str = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
  return JSON.parse(str);
}

export function verifySupabaseJwt(token: string, jwtSecret: string): JwtClaims {
  const [headerB64, payloadB64, sigB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !sigB64) throw new Error("Invalid JWT");
  const signingInput = `${headerB64}.${payloadB64}`;

  const expected = crypto
    .createHmac("sha256", jwtSecret)
    .update(signingInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (expected !== sigB64) throw new Error("JWT signature mismatch");
  const payload = b64urlToJson(payloadB64);
  return { sub: payload.sub, email: payload.email };
}

export type AuthedRequest = Request & {
  user?: { userId: string; email?: string; orgId: string; role: string };
};

import { supabaseAdmin } from "./supabase.js";

export function authMiddleware(jwtSecret: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const auth = req.header("authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!token) return res.status(401).json({ error: "Missing token" });

      const claims = verifySupabaseJwt(token, jwtSecret);
      const userId = claims.sub;

      const { data, error } = await supabaseAdmin
        .from("org_memberships")
        .select("org_id, role")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (error || !data) return res.status(403).json({ error: "No org membership" });

      req.user = { userId, email: claims.email, orgId: data.org_id, role: data.role };
      next();
    } catch (e: any) {
      return res.status(401).json({ error: e?.message ?? "Unauthorized" });
    }
  };
}
