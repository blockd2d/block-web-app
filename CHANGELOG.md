# Changelog

This changelog is scoped to the updates made to **block-v7_repo_latest_fixed.zip** to satisfy the V7 acceptance checklist.

## Web (apps/web)

- **Sales module added**
  - Added `/app/sales` list page with pagination + filters (date range preset/custom, rep filter (admin/manager only), status filter, search).  
    - Files: `apps/web/src/app/app/sales/page.tsx`, `apps/web/src/ui/sales/sale-status-badge.tsx`, `apps/web/src/ui/sales/sale-status-select.tsx`
  - Added `/app/sales/[saleId]` detail page with customer info, service info, status + payment state, attachments gallery (signed URLs from API), contract link (signed URL), and audit timeline.
    - File: `apps/web/src/app/app/sales/[saleId]/page.tsx`
  - Kept existing export flow and added a Sales export shortcut from Sales list.
    - File: `apps/web/src/app/app/sales/page.tsx`

- **Navigation updates**
  - Added/confirmed sidebar items: Sales, Follow-ups, Audit (admin/manager only), Settings with role-based visibility.
    - File: `apps/web/src/ui/shell.tsx`

- **Dashboard enhancement**
  - When a cluster is selected, show a compact summary card (houses, potential, assigned rep, status rollups, follow-ups due) with deep link to the territory inspector.
    - File: `apps/web/src/app/app/dashboard/page.tsx`
  - Added territory deep-link support: `/app/territories/:clusterSetId?cluster=:clusterId`.
    - File: `apps/web/src/app/app/territories/[clusterSetId]/page.tsx`

## API (apps/api)

- **Sales endpoints**
  - Implemented/confirmed:
    - `GET /v1/sales` (paginated + filters)
    - `GET /v1/sales/:id` (detail)
    - `GET /v1/sales/:id/attachments` (signed URLs)
    - `POST/PUT /v1/sales` for create/update with org isolation + RBAC
    - Files: `apps/api/src/routes/sales.ts`

- **Attachments via Supabase Storage**
  - API issues signed URLs from the `attachments` bucket; web never uses Supabase client.
    - Files: `apps/api/src/routes/sales.ts`, `apps/api/src/lib/storage.ts`

- **Audit logging**
  - Sale create/update/status changes write to audit events, and sales detail includes an audit timeline.
    - Files: `apps/api/src/routes/sales.ts`, `apps/api/src/lib/audit.ts`

- **Analytics reliability**
  - Daily stats endpoints return zeros/empty-state payloads when no rows exist (no hard errors for empty tables).
    - Files: `apps/api/src/routes/analytics.ts`, `apps/api/src/routes/dashboard.ts`

- **Sales export improved**
  - `export_sales` worker now exports from `sales_view` so exports include customer + address + derived pipeline status.
    - File: `apps/api/src/worker/processors.ts`

## Supabase

- Added/confirmed a denormalized sales view and customer fields.
  - Migration: `supabase/migrations/0010_sales_customer_and_view.sql`

## Repo / deployment hardening

- Added `.nvmrc` pin for Node.
- Added `pnpm-lock.yaml` placeholder and deployment notes (generate a real lockfile before freezing builds).
- Added `DEPLOYMENT.md` and updated `docs/deployment.md` bucket/migration list.
- Updated `README.md` with Vercel (Turborepo) settings.
