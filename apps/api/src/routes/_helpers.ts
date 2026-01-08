import type { FastifyRequest } from 'fastify';
import { requireRole, type AuthContext, type Role } from '../lib/auth';

export function requireAuth(req: FastifyRequest): AuthContext {
  if (!req.ctx) {
    const err: any = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
  return req.ctx;
}

export function requireRoles(req: FastifyRequest, roles: Role[]): AuthContext {
  const ctx = requireAuth(req);
  requireRole(ctx, roles);
  return ctx;
}

export const requireManager = (req: FastifyRequest) => requireRoles(req, ['admin', 'manager']);
export const requireAnyAuthed = (req: FastifyRequest) => requireAuth(req);
