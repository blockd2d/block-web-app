import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "blocklabor.access_token";
const REFRESH_TOKEN_KEY = "blocklabor.refresh_token";
/** @deprecated Legacy key; kept for migration. */
const LEGACY_SESSION_KEY = "blocklabor.supabase_session";

export async function getStoredSession(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(LEGACY_SESSION_KEY);
  } catch {
    return null;
  }
}

export async function setStoredSession(value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(LEGACY_SESSION_KEY, value);
  } catch (e) {
    console.warn("[storage] Failed to persist session", e);
  }
}

export async function clearStoredSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(LEGACY_SESSION_KEY);
  } catch {
    // noop
  }
}

// API token storage (used when using Block API for auth)
export async function getStoredAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getStoredRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredTokens(access: string, refresh: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
  } catch (e) {
    console.warn("[storage] Failed to persist tokens", e);
  }
}

export async function clearStoredTokens(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    // noop
  }
}
