/**
 * Block API HTTP client for new-labor-mobile.
 * Uses Bearer token and x-block-client: mobile. Handles 401 with refresh + retry.
 */

const BASE =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "http://localhost:4000";

export type TokenGetter = () => string | null;
export type OnSessionCleared = () => void;

let getAccessToken: TokenGetter = () => null;
let onSessionCleared: OnSessionCleared = () => {};
/** Returns true if new tokens were stored and request can be retried. */
let refreshSession: () => Promise<boolean> = async () => false;

export function setApiAuth(
  getter: TokenGetter,
  onCleared: OnSessionCleared,
  doRefresh?: () => Promise<boolean>
) {
  getAccessToken = getter;
  onSessionCleared = onCleared;
  if (doRefresh) refreshSession = doRefresh;
}

export function getApiBase(): string {
  return BASE;
}

/** Error-like object for API failures (plain object to avoid Hermes "Super expression" issues). */
export type ApiError = { name: string; message: string; status: number; data: unknown };

export function createApiError(message: string, status: number, data: unknown): ApiError {
  return { name: "ApiError", message, status, data };
}

export function isApiError(e: unknown): e is ApiError {
  return !!e && typeof e === "object" && "status" in e && (e as ApiError).name === "ApiError";
}

async function doRequest(
  method: string,
  path: string,
  body?: unknown,
  skipRefresh = false
): Promise<unknown> {
  const url = path.startsWith("http") ? path : BASE + path;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-block-client": "mobile",
  };
  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (res.status === 401 && !skipRefresh) {
    const refreshed = await refreshSession();
    if (refreshed) return doRequest(method, path, body, true);
    onSessionCleared();
    throw createApiError("Unauthorized", 401, data);
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && ("error" in data
        ? (data as { error?: string }).error
        : "message" in data
          ? (data as { message?: string }).message
          : undefined)) || "Request failed";
    throw createApiError(String(msg), res.status, data);
  }
  return data;
}

export async function request(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  return doRequest(method, path, body, false);
}

export const api = {
  get: (path: string) => request("GET", path),
  post: (path: string, body?: unknown) => request("POST", path, body),
  put: (path: string, body?: unknown) => request("PUT", path, body),
  patch: (path: string, body?: unknown) => request("PATCH", path, body),
  del: (path: string) => request("DELETE", path),
};
