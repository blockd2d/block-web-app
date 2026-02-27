import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** Headers we forward from the client to the API */
const FORWARD_REQUEST_HEADERS = [
  'content-type',
  'cookie',
  'x-csrf',
  'authorization',
  'x-block-client'
];

/** Forward Set-Cookie from API response but strip Domain so the cookie applies to the web origin */
function rewriteSetCookieHeaders(apiResponse: Response): string[] {
  const h = apiResponse.headers as Headers & { getSetCookie?: () => string[]; raw?: () => Record<string, string[]> };
  const setCookies =
    h.getSetCookie?.() ??
    (Array.isArray((h as any).raw?.()['set-cookie'])
      ? (h as any).raw()['set-cookie']
      : apiResponse.headers.get('set-cookie')
        ? [apiResponse.headers.get('set-cookie')!]
        : []);
  const out: string[] = [];
  for (const raw of setCookies) {
    if (!raw) continue;
    // Remove Domain=... so the cookie is set for the current host (web app)
    const rewritten = raw
      .split('; ')
      .filter((part) => !/^Domain=/i.test(part))
      .join('; ');
    out.push(rewritten);
  }
  return out;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  return proxy(req, context, 'GET');
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  return proxy(req, context, 'POST');
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  return proxy(req, context, 'PUT');
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  return proxy(req, context, 'PATCH');
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  return proxy(req, context, 'DELETE');
}

async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
  method: string
) {
  const { path: pathSegments } = await context.params;
  const path = pathSegments?.length ? `/${pathSegments.join('/')}` : '';
  const url = `${API_BASE.replace(/\/$/, '')}${path}${req.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  let body: string | undefined;
  const contentType = req.headers.get('content-type') || '';
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      body = await req.text();
    } catch {
      // no body
    }
  }

  const apiRes = await fetch(url, {
    method,
    headers,
    body: body !== undefined && body !== '' ? body : undefined,
    cache: 'no-store'
  });

  const responseHeaders = new Headers();
  const forwardResponseHeaders = ['content-type', 'content-length'];
  for (const name of forwardResponseHeaders) {
    const value = apiRes.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  const setCookies = rewriteSetCookieHeaders(apiRes);
  for (const cookie of setCookies) {
    responseHeaders.append('Set-Cookie', cookie);
  }

  const resBody = apiRes.body;
  return new NextResponse(resBody, {
    status: apiRes.status,
    statusText: apiRes.statusText,
    headers: responseHeaders
  });
}
