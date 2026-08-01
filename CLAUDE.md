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
| `saas/setup.sql` | Postgres schema (run once in Supabase SQL editor). |
| `supabase/functions/admin-stats/index.ts` | Multi-action Edge Function for all admin + user actions. |
| `supabase/functions/ai-assistant/index.ts` | AI funeral assistant (Claude API). |
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
| `update_notes` | Owner | Saves admin notes for a user profile |
| `update_plan` | Owner | Changes a user's plan |
| `update_ai_limit` | Owner | Changes AI call limit for a user |

Owner = `ststamato@gmail.com` or `funeralos.net@gmail.com`.

## Database Tables

- `profiles` — one row per user: `id`, `referral_code`, `referral_credits`, `referral_plan_until`, `admin_notes`
- `support_requests` — `id`, `user_id`, `subject`, `message`, `status` (open/resolved), `created_at`, `resolved_at`
- `ai_usage` — `user_id`, `calls_today`, `reset_date`
- `referrals` — tracks who referred whom

RLS is enabled on all tables. Users can only read/write their own rows.

## Supabase Secrets

| Secret | Value |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (auto-injected by Supabase) |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `FROM_EMAIL` | `noreply@funeralos.net` |
| `GITHUB_TOKEN` | GitHub PAT with `issues: write` on this repo |

## Deployment

- **Frontend**: push to `main` → Cloudflare Pages auto-deploys from `saas/` directory.
- **Edge Functions**: `supabase functions deploy admin-stats --project-ref rqklpnrgpiprttzsploe`
- **Cache-busting**: `app.js` is loaded with `?v=N` query string in app.html files. Increment `N` when changing `app.js`.

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
