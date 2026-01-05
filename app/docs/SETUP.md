# Block V7 – Local Dev Setup

## Prereqs
- Node 20+
- pnpm
- Supabase CLI
- A Supabase project (local or hosted)
- Railway service for API/worker (can run locally)

## Install
```bash
pnpm install
```

## Supabase (local)
```bash
supabase start
supabase db reset
```

Apply migrations:
```bash
supabase migration up
```

## API (local)
Create `apps/api/.env` from `.env.example` (see root docs/DEPLOYMENT.md).
```bash
pnpm --filter @block/api dev
pnpm --filter @block/api worker
```

## Manager Web (local)
```bash
pnpm --filter @block/manager-web dev
```

## Labor Mobile (local)
```bash
cd apps/labor-mobile
npx expo start
```

