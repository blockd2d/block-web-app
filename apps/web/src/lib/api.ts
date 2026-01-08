function getCsrf() {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/block_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
}

async function request(method: string, path: string, body?: any, init?: RequestInit) {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers ? Object.fromEntries(new Headers(init.headers as any).entries()) : {})
  };

  // CSRF header for cookie-auth
  const csrf = getCsrf();
  if (csrf) headers['x-csrf'] = csrf;

  const res = await fetch(base + path, {
    ...init,
    method,
    headers,
    credentials: 'include',
    body:
      body != null
        ? typeof body === 'string' || body instanceof FormData || body instanceof Blob
          ? (body as any)
          : JSON.stringify(body)
        : init?.body
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || 'Request failed';
    throw new Error(msg);
  }
  return data;
}

type ApiFn = ((path: string, init?: RequestInit) => Promise<any>) & {
  base: () => string;
  get: (path: string, init?: RequestInit) => Promise<any>;
  post: (path: string, body?: any, init?: RequestInit) => Promise<any>;
  put: (path: string, body?: any, init?: RequestInit) => Promise<any>;
  del: (path: string, init?: RequestInit) => Promise<any>;
};

/**
 * API helper.
 * Supports both styles:
 * - await api('/v1/reps')
 * - await api.get('/v1/reps')
 */
export const api: ApiFn = Object.assign(
  async (path: string, init?: RequestInit) => {
    const method = (init?.method || 'GET').toUpperCase();
    // If caller provided a body in init, pass it through.
    // Otherwise treat as GET.
    const hasBody = (init as any)?.body != null;
    if (!hasBody) {
      return request(method, path, undefined, init);
    }

    // Try to parse JSON body strings for error readability, but don't modify.
    return request(method, path, undefined, init);
  },
  {
    base: () => apiBase(),
    get: (path: string, init?: RequestInit) => request('GET', path, undefined, init),
    post: (path: string, body?: any, init?: RequestInit) => request('POST', path, body, init),
    put: (path: string, body?: any, init?: RequestInit) => request('PUT', path, body, init),
    del: (path: string, init?: RequestInit) => request('DELETE', path, undefined, init)
  }
);
