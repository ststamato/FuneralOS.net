# App Privacy (Apple) / Data Safety (Google) — form answers

Mapping from the real data model (Supabase tables — see root `CLAUDE.md`),
matching the already-updated `privacy.html` / `en/privacy.html`. Shared by
both editions; the USA edition also collects staff/fleet fields.

| Category | Data | Linked to identity? | Purpose |
|---|---|---|---|
| Identifiers | User ID, email address | Linked | Account, authentication |
| Identifiers | Device push token (`native_push_tokens`) | Linked | App functionality (notifications) |
| Contact Info | Name, phone, address of the deceased and their family — entered by the office, not the app's own account holder | Linked to the office's data | App functionality (case records) |
| User Content | Case documents (`case_documents` — death certificates, permits, contracts), case notes | Linked | App functionality |
| Financial Info | Case value, balance, payment status — no card numbers | Linked | App functionality |
| Payment Info | Card details | **Not collected** | Handled entirely by Apple/Google IAP, RevenueCat, Lemon Squeezy — never touches FuneralOS servers |
| Usage Data | Product interaction / analytics | **Not collected** | No analytics SDK ships inside the native app bundle |
| Diagnostics | Crash logs, performance data | **Not collected** | No crash-reporting SDK wired in yet |
| Sensitive Info | Religious rite / ceremony details tied to a case | **Needs a human call — see below** | |

**Tracking:** none of this is used for cross-app/cross-site tracking or
third-party advertising.
- Apple's "Data Used to Track You" → **None**
- Google's "Does your app share user data with third parties for
  advertising" → **No**

## The one field that needs a human decision

A ceremony record can include the religious rite being performed (e.g.
"Orthodox funeral service"). Apple's Sensitive Info category is built
around things like race, religion, and sexual orientation. Whether
recording that as an operational scheduling field counts as collecting
that category is a judgment call — not something to guess silently in a
form both stores hold you to.

Decide, then declare in both consoles:
- **If yes** (treating rite/denomination as Sensitive Info): declare it,
  describe purpose as "app functionality — service scheduling," confirm
  it's collected with the office's own authorization (implicit — it's
  their own customer's data they're entering), not shared with third
  parties.
- **If no** (treating it as ordinary operational metadata, no different
  from noting a burial vs. cremation): skip the Sensitive Info
  declaration, but keep the Contact Info / User Content rows above as-is.

## Processors to declare (both forms)

Supabase, Apple/Google IAP + RevenueCat, Firebase Cloud Messaging, Lemon
Squeezy, Resend, Anthropic (support-ticket triage) — matches the "Third
Party Services" section already in `privacy.html` / `en/privacy.html`.
