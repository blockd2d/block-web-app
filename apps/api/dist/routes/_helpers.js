import { requireRole } from '../lib/auth';
export function requireAuth(req) {
    if (!req.ctx) {
        const err = new Error('Unauthorized');
        err.statusCode = 401;
        throw err;
    }
    return req.ctx;
}
export function requireRoles(req, roles) {
    const ctx = requireAuth(req);
    requireRole(ctx, roles);
    return ctx;
}
export const requireManager = (req) => requireRoles(req, ['admin', 'manager']);
export const requireAnyAuthed = (req) => requireAuth(req);
//# sourceMappingURL=_helpers.js.map