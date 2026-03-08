# Block Labor (new-labor-mobile)

React Native + Expo labor app for field crews. Built per the Block Labor App PRD.

## Setup

1. Copy `.env.example` to `.env` and set:
   - `EXPO_PUBLIC_SUPABASE_URL` – your Supabase project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` – Supabase anon key (RLS enforces labor access)

2. From repo root:
   ```bash
   pnpm install
   cd apps/new-labor-mobile && pnpm start
   ```
   Then press `i` (iOS), `a` (Android), or `w` (web).

## Features

- **Auth**: Email/password sign-in via Supabase Auth; secure session restore; labor-only role gate.
- **Today’s Schedule**: List of crew-assigned jobs for today with status and unsynced indicators.
- **Upcoming**: Future scheduled jobs.
- **Job Detail**: Customer, address, tap-to-call/tap-to-text, service info, notes, map placeholder, status control, checklist, notes, issue reporting, photos.
- **Status**: Labor can set status from new → scheduled → en_route → arrived → in_progress → paused → complete.
- **Checklist**: Fixed checklist per job; persist to backend (tables per PRD Appendix A).
- **Notes & Issues**: Add job notes; report issues with type (customer not home, access blocked, etc.).
- **Photos**: Capture or pick photos; upload to Supabase Storage; attachment metadata.
- **Offline**: Queue store (Zustand + AsyncStorage); sync banner when pending changes exist.
- **Clock In/Out**: Shift events stored in `labor_shift_events`.
- **Push**: Register Expo push token with backend for assignments and schedule changes.

## Backend

Expects Supabase with RLS and tables (or views) as in the PRD Appendix A: `jobs`, `job_checklist_templates`, `job_checklist_template_items`, `job_checklist_responses`, `job_notes`, `job_issue_reports`, `labor_shift_events`, `attachments`, `push_notification_devices`, etc. When a table is missing, the app degrades (e.g. empty lists, no checklist items).

## Release

- **Internal**: Use EAS/Expo internal distribution.
- **Store**: Add production icons/splash, permission strings, privacy disclosures, and App Store / Play Store metadata per PRD Phase B.
