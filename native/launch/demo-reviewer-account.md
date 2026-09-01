# Demo account for App Store / Play Store review

Both stores require working login credentials in the submission notes so a
reviewer can actually use the app, not just look at screenshots.

## Why this is a manual step, not a seed script

It would be tempting to write a SQL script that inserts a demo office plus
a few sample `ceremonies` rows directly. Two reasons not to:

1. **`auth.users` isn't a plain table to insert into** — Supabase Auth
   (GoTrue) owns password hashing and session state; creating a user via
   raw SQL bypasses that and tends to produce accounts that don't
   actually authenticate.
2. **`ceremonies.data` is a free-form jsonb blob** shaped by `app.js`'s
   own form logic, not documented as a fixed schema anywhere. Guessing at
   its shape risks a malformed case record that renders broken in the
   reviewer's hands — worse than an empty account.

Creating the account through the real signup flow and entering 1-2 sample
cases by hand takes about 5 minutes and guarantees the data is exactly
what the app itself produces.

## Steps (do this once per edition, after a working native build exists)

1. Sign up a dedicated demo account through the live app (not your own):
   - GR: `demo-review@funeralos.net` (or similar) via `funeralos.net/login.html`
   - EN: a separate one, e.g. `demo-review-usa@funeralos.net` via `funeralos.net/en/login.html`
2. As the owner (`ststamato@gmail.com` / `funeralos.net@gmail.com`), call
   `admin-stats` to upgrade the demo account's plan so reviewers see the
   full feature set (Business tier, not the free-plan limits):
   ```
   POST https://rqklpnrgpiprttzsploe.supabase.co/functions/v1/admin-stats
   Authorization: Bearer <owner JWT>
   { "action": "update_plan", "user_id": "<demo account's uid>", "plan": "business" }
   ```
3. Log in as the demo account and create 2-3 realistic sample
   cases/ceremonies through the normal UI — enough that Overview,
   Warehouse (GR) / Staff & Fleet (EN), and the AI assistant panel all
   have something to show a reviewer, without using any real deceased
   person's actual information.
4. Note the credentials for submission — both stores ask for them in a
   "App Review Information" / "Notes for reviewer" field:
   ```
   Email: demo-review@funeralos.net
   Password: <set at signup>
   ```
5. If Apple's reviewer flags "sign in required, provide demo access" —
   this is exactly what these credentials are for; paste them into the
   App Review Information section of the version being submitted.

## Reviewer notes template (paste into both consoles)

```
This app is used by licensed funeral home staff to manage cases, documents,
staff scheduling and vehicle fleet. Demo login below has sample data
pre-loaded — no real customer or deceased-person information.

Email: demo-review@funeralos.net
Password: <fill in>

In-app purchases (Pro/Business plans) can be tested via the "Αναβάθμιση" /
"Upgrade" button in Settings.
```
