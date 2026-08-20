# FuneralOS — Codebase Guide

FuneralOS is a Greek funeral-office management SaaS at **funeralos.net**. It has a Greek edition (`/gr/`) and an English edition (`/en/`).

## Architecture

- **Frontend**: Static HTML/CSS/JS, no build step. Hosted on Cloudflare Pages from the `saas/` directory.
- **Backend**: Supabase (Postgres + Auth + Edge Functions). Project ref: `rqklpnrgpiprttzsploe`.
- **Transactional email**: Resend API (`noreply@funeralos.net`). Domain verified in Resend (eu-west-1).
- **Payments**: LemonSqueezy (webhook handled by `lemon-webhook` edge function).

## Key Files

| File | Purpose |
|---|---|
| `saas/app.html` | Main app (Greek). All UI logic inline + loads `app.js`. |
| `saas/en/app.html` | Main app (English). Mirror of app.html with EN strings. |
| `saas/app.js` | Shared JS logic (funeral case forms, AI assistant, support modal, etc.). |
| `saas/admin.html` | Admin panel (owner-only). User list, support requests, stats. |
| `saas/login.html` | Auth page (Greek). Supabase email/password. |
| `saas/en/login.html` | Auth page (English). |
| `supabase/setup.sql` | Postgres schema (authoritative, idempotent — run in Supabase SQL editor). `saas/setup.sql` is a deprecated stub pointing here. |
| `supabase/functions/admin-stats/index.ts` | Multi-action Edge Function for all admin + user actions. |
| `supabase/functions/ai-assistant/index.ts` | AI funeral assistant (xAI Grok API, model `grok-3-mini`). |
| `supabase/functions/team-invite/index.ts` | Team member email invitations. |
| `supabase/functions/lemon-webhook/index.ts` | Payment webhook → upgrades user plan. |

## admin-stats Edge Function — Actions

All calls are `POST` with JSON body `{ action: "...", ...params }`.

| Action | Auth | Description |
|---|---|---|
| `submit_support` | User JWT | Saves support request to DB, emails admin, creates GitHub Issue |
| `list` | Owner | Returns all users with AI usage, profiles, referrals |
| `support_list` | Owner | Returns all support requests with user emails |
| `support_resolve` | Owner | Marks a support request as resolved |
| `list_webhook_failures` | Owner | Returns unresolved Lemon Squeezy webhook events that couldn't be matched to a user |
| `resolve_webhook_failure` | Owner | Marks an unmatched webhook event as resolved after manual review |
| `update_notes` | Owner | Saves admin notes for a user profile |
| `update_plan` | Owner | Changes a user's plan |
| `update_ai_limit` | Owner | Changes AI call limit for a user |
| `update_features` | Owner | Toggles per-user feature flags (`profiles.features`) |

Owner = `ststamato@gmail.com` or `funeralos.net@gmail.com`.

## Database Tables

- `app_state` — one row per office: `id` (office owner's user id), `payload` (jsonb — warehouse, sets, changelog, etc.; ceremonies no longer live here, see below), `updated_at`
- `ceremonies` — one row per case (moved out of `app_state.payload` to fix concurrent-save data loss): `id`, `office_id`, `data` (jsonb), `updated_at`, `updated_by`, `created_at`. Writes go through the `save_ceremony()` RPC (optimistic-locked on `updated_at`, also enforces the free-plan monthly limit server-side, keyed on `created_at`). Deletes go through `delete_ceremony()` (same optimistic-lock discipline); RLS restricts delete to the office owner or an admin-role member — editors can create/edit but not delete
- `office_members` — team membership: `office_id`, `user_id`, `role` (`admin`/`editor`)
- `office_invites` — pending team invites (service-role only, no client RLS)
- `office_events` — per-office activity/change log: `user_id` (who acted), `office_id` (which office it belongs to), `event_type`, `payload`
- `case_documents` — USA edition case file attachments: `office_id`, `case_id`, `doc_type`, `storage_path` (private `case-documents` Storage bucket), `filename`. One row per (office, case, doc_type), replaced on re-upload
- `profiles` — one row per user: `id`, `referral_code`, `referral_credits`, `referral_plan_until`, `admin_notes`, `features` (jsonb, per-user feature flags). No client update policy — all writes go through the signup trigger or owner-only admin-stats actions
- `support_requests` — `id`, `user_id`, `subject`, `message`, `status` (open/resolved), `created_at`, `resolved_at`
- `ai_usage` — `user_id`, `calls_today`, `reset_date`. Read-only for the owning user; all writes go through `claim_ai_usage_slot()` (service-role only)
- `referrals` — tracks who referred whom
- `processed_webhook_events` — replay protection for `lemon-webhook` (SHA-256 hash of each successfully-processed webhook body)
- `webhook_unmatched_events` — Lemon Squeezy webhook events that couldn't be matched to a Supabase user; reviewed via the `list_webhook_failures`/`resolve_webhook_failure` admin-stats actions

RLS is enabled on all tables. Users can read/write their own office's rows; team members (via `office_members`) share access to their office's `app_state`/`ceremonies` rows through the `is_office_member()` helper.

## Supabase Secrets

| Secret | Value |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (auto-injected by Supabase) |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `FROM_EMAIL` | `noreply@funeralos.net` |
| `GITHUB_TOKEN` | GitHub PAT with `issues: write` on this repo |
| `XAI_API_KEY` | xAI API key, used by `ai-assistant` (Grok) |
| `ANTHROPIC_API_KEY` | Used by `admin-stats` to analyze support tickets via Claude (`claude-haiku-4-5`) and comment on the GitHub issue |

## Deployment

- **Frontend**: push to `main` → Cloudflare Pages auto-deploys from `saas/` directory.
- **Edge Functions**: `supabase functions deploy <function-name> --project-ref rqklpnrgpiprttzsploe` (e.g. `admin-stats`, `ai-assistant`, `team-invite`, `lemon-webhook`)
- **Cache-busting**: `app.js` is loaded with `?v=N` query string in app.html files. Increment `N` when changing `app.js`.

### Runbook — schema migrations that move data out of `app_state.payload`

There is no CI/CD gate enforcing order here — deploys are manual (one person, no staging environment), so getting the order wrong is a real risk, not theoretical. When a change moves a field out of the jsonb blob into its own table (as `ceremonies` was, to fix concurrent-save data loss — see git history), follow this order, not the reverse:

1. Run the SQL in Supabase SQL editor: new table + RLS + RPC + the backfill that copies existing data out of `app_state.payload` into the new table. This step alone is safe — nothing reads the new table yet.
2. Spot-check the backfill actually worked, e.g. `select count(*) from ceremonies;` vs. counting the equivalent field across `app_state.payload` rows. Don't skip this — it's the only check between "safe" and "users see empty data."
3. Only then push the client (`app.js`) that reads/writes the new table. If this ships before step 1–2 are confirmed, a user's next load reads an empty table and the app looks like their data vanished.
4. If a field is fully migrated (old code no longer reads or writes it), consider stripping the stale key from `app_state.payload` once the new path has been running cleanly for a while — leaving it forever is tempting as a "rollback net" but silently invites a bad fallback later (e.g. "if the new table looks empty, read the old blob" — which would resurrect data a user legitimately deleted after migrating). `ceremonies` was cleaned up this way; see the `update app_state set payload = payload - 'ceremonies' ...` step in `supabase/setup.sql`.

## Support Request Workflow

1. User submits request via in-app modal → `submit_support` action
2. Saved to `support_requests` table
3. Email sent to `funeralos.net@gmail.com` via Resend
4. GitHub Issue created in this repo with label `support`
5. Owner reviews issue and comments `@claude [instruction]`

### IMPORTANT — Per-user vs global changes

**Most support requests affect only the requesting user's data** — they are NOT global code changes.

When responding to a support issue, first check if the request can be handled via an admin action:

| User asks for… | Admin action to take |
|---|---|
| More AI credits / higher limit | `update_ai_limit` — `{ action: "update_ai_limit", user_id: "...", limit: N }` |
| Plan upgrade/downgrade | `update_plan` — `{ action: "update_plan", user_id: "...", plan: "pro" }` |
| Account note / custom setting | `update_notes` — `{ action: "update_notes", user_id: "...", notes: "..." }` |
| Mark request resolved | `support_resolve` — `{ action: "support_resolve", id: "..." }` |

These are called as `POST` to `https://rqklpnrgpiprttzsploe.supabase.co/functions/v1/admin-stats` with the owner's Bearer token. **No code change or PR is needed** for these — tell the admin which action to call with which parameters.

Only open a PR when the request is a genuine **feature request or bug report** that requires a code change affecting all users.

## Code Conventions

- No TypeScript build step for frontend — plain ES2022 JS in `<script>` tags
- Greek strings in `app.html`/`login.html`, English in `en/` equivalents
- Edge Functions: Deno + TypeScript. No npm — use `https://deno.land/x/` imports if needed (currently none)
- No framework. DOM manipulation is vanilla JS.
- CSS custom properties for theming: `--ink`, `--gold`, `--gold-light`, `--cream`, `--muted`, `--border`, `--radius`
