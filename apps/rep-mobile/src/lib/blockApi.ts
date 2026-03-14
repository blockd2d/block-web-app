import { config } from "./runtimeConfig";

export type BlockSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
};

let session: BlockSession | null = null;

export function setSession(s: BlockSession | null) {
  session = s;
}

export function getSession(): BlockSession | null {
  return session;
}

export function clearSession() {
  session = null;
}

const API_URL = config.apiUrl;

function getErrorMessage(data: unknown): string {
  if (data && typeof data === "object" && "error" in data && typeof (data as any).error === "string") return (data as any).error;
  if (data && typeof data === "object" && "message" in data && typeof (data as any).message === "string") return (data as any).message;
  return "Request failed";
}

async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const currentSession = session;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-block-client": "mobile"
  };

  if (currentSession?.access_token) headers.Authorization = `Bearer ${currentSession.access_token}`;

  const res = await fetch(API_URL + path, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined
  });

  const ct = res.headers.get("content-type") || "";
  const data: unknown = ct.includes("application/json") ? await res.json() : await res.text();

  if (res.ok) return data as T;

  // If unauthorized, attempt one refresh then retry once.
  if (res.status === 401 && currentSession?.refresh_token) {
    try {
      const refreshed = await fetch(API_URL + "/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-block-client": "mobile" },
        body: JSON.stringify({ refresh_token: currentSession.refresh_token })
      });
      const rct = refreshed.headers.get("content-type") || "";
      const rdata: unknown = rct.includes("application/json") ? await refreshed.json() : await refreshed.text();
      if (refreshed.ok && rdata && typeof rdata === "object" && (rdata as any)?.session?.access_token) {
        const newSession = (rdata as any).session;
        session = {
          access_token: newSession.access_token,
          refresh_token: newSession.refresh_token ?? currentSession.refresh_token,
          expires_in: newSession.expires_in,
          expires_at: newSession.expires_at
        };
        return request<T>(method, path, body);
      }
    } catch {
      // ignore
    }
  }

  throw new Error(getErrorMessage(data));
}

export const blockApi = {
  apiUrl: API_URL,

  getSession,
  setSession,
  clearSession,

  get: <T = unknown>(path: string) => request<T>("GET", path),
  post: <T = unknown>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T = unknown>(path: string, body?: unknown) => request<T>("PUT", path, body)
};
