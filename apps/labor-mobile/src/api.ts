import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

async function getToken() {
  return (await SecureStore.getItemAsync('token')) || null;
}

export async function hasSession() {
  const t = await getToken();
  return !!t;
}

async function request(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {})
    }
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.error || json?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export const api = {
  async login(email: string, password: string) {
    const data = await request('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    await SecureStore.setItemAsync('token', data.token);
    return data;
  },
  async logout() {
    await SecureStore.deleteItemAsync('token');
  },
  async me() {
    return request('/v1/auth/me');
  },
  async listJobs() {
    return request('/v1/jobs');
  },
  async getJob(jobId: string) {
    return request(`/v1/jobs/${encodeURIComponent(jobId)}`);
  },
  async startJob(jobId: string) {
    return request(`/v1/jobs/${encodeURIComponent(jobId)}/start`, { method: 'POST' });
  },
  async completeJob(jobId: string, payload?: { completion_notes?: string; upcharge_notes?: string }) {
    return request(`/v1/jobs/${encodeURIComponent(jobId)}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },
  async uploadJobPhoto(jobId: string, payload: { kind: string; filename?: string; data_url?: string }) {
    return request(`/v1/jobs/${encodeURIComponent(jobId)}/photos`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async listJobPhotos(jobId: string) {
    return request(`/v1/jobs/${encodeURIComponent(jobId)}/photos`);
  },
  async getAvailability() {
    return request('/v1/labor/availability');
  },
  async setAvailability(blocks: Array<{ day_of_week: number; start_time: string; end_time: string; timezone?: string }>) {
    return request('/v1/labor/availability', { method: 'PUT', body: JSON.stringify({ blocks }) });
  },
  async getTimeOff() {
    return request('/v1/labor/time-off');
  },
  async addTimeOff(start_at: string, end_at: string, reason?: string) {
    return request('/v1/labor/time-off', { method: 'POST', body: JSON.stringify({ start_at, end_at, reason }) });
  },
  async deleteTimeOff(id: string) {
    return request(`/v1/labor/time-off/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async createPaymentLink(job_id: string, amount: number, currency: string = 'usd') {
    return request('/v1/payments/create-intent', { method: 'POST', body: JSON.stringify({ job_id, amount, currency }) });
  }
};
