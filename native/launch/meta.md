# Categories, age rating & URLs

Same values for both editions unless noted.

| Field | Value | Note |
|---|---|---|
| Apple primary category | Business | |
| Apple secondary category | Productivity | |
| Google Play category | Business | |
| Age rating | 4+ / Everyone | Professional case-management tool — no graphic, violent, or user-generated public content |
| Support URL | `funeralos.net/gr/` (GR) · `funeralos.net/en/` (EN) | Apple requires an actual URL, not a `mailto:` link — both landing pages already carry an FAQ and a contact address |
| Marketing URL | `funeralos.net` | |
| Privacy policy URL | `funeralos.net/privacy.html` (GR) · `funeralos.net/en/privacy.html` (EN) | Both pages already reflect the real data model (server-side `ceremonies`, native IAP, push tokens, self-service deletion) |

## Google Play — "App content" declarations

Play blocks publishing until every one of these is answered. Values below
apply to both editions.

| Declaration | Answer | Why |
|---|---|---|
| Privacy policy | the URL above | Required; must be reachable and mention the app by name |
| Ads | **No ads** | No ad SDK ships in the bundle |
| App access | **Restricted — all functionality requires a login** | Provide the reviewer credentials from `demo-reviewer-account.md`; leaving this as "not restricted" gets the review rejected the moment they hit the login screen |
| Content rating | complete the questionnaire | Business/utility tool, no user-generated public content, no violence or objectionable material → expect Everyone / PEGI 3 |
| Target audience | **18 and over** | A professional tool for funeral-home staff. Do **not** tick any under-13 age band — that pulls the app into the Families policy programme, with much stricter rules on data collection |
| News app | **No** | |
| Government app | **No** | |
| Financial features | **No** | Selling a subscription to your own software is not a financial feature; that category means lending, banking, crypto and similar |
| Health apps | **No** | |
| Data safety | from `privacy-labels.md` | Answer the Sensitive Info judgment call there first |

## Google Play — store settings & contact

| Field | Value |
|---|---|
| App category | Business |
| Store listing contact — email | `funeralos.net@gmail.com` |
| Store listing contact — website | `https://funeralos.net` |
| Store listing contact — phone | already verified in the console |
| Pricing | **Free**, with in-app purchases |
| Countries | GR edition: Greece + Cyprus at minimum · EN edition: United States |

## Apple — fields the listing copy doesn't cover

| Field | Value |
|---|---|
| Copyright | `2026 FuneralOS` |
| Sign-in required | **Yes** — Apple mandates working demo credentials for any app behind a login. See `demo-reviewer-account.md`. An app that a reviewer cannot get into is rejected, every time |
| App Review notes | Explain that this is a B2B tool for funeral offices, that the case data visible in the demo account is fabricated, and how to reach the upgrade screen and the delete-account flow |
| In-app purchases | Each subscription needs its own display name, description and **review screenshot** before it can be submitted alongside the build — these are separate review items, not part of the listing |

## Export compliance (Apple)

**Already answered in code** — `ITSAppUsesNonExemptEncryption` is set to
`false` in both `Info.plist` files, so App Store Connect no longer asks this
on upload. The reasoning it encodes:

FuneralOS uses only standard HTTPS/TLS (via Supabase, RevenueCat, Firebase,
Lemon Squeezy) — no proprietary or non-exempt encryption. Answer:

> **Does your app use encryption?** Yes
> **Does your app qualify for any of the exemptions provided in
> Category 5, Part 2 of the U.S. Export Administration Regulations?** Yes
> (exempt — standard encryption used only for authentication/data transport)

This is the standard answer for apps that only call HTTPS APIs; no export
compliance documentation (CCATS/self-classification report) is required
beyond checking this box. If the question does still appear — Apple reworks
this screen periodically — answer it as above.

## Content rights (both stores)

FuneralOS owns or licenses all rights to the content in the app (UI text,
icon, illustrations). Case data, documents and photos are entered by the
customer's own office — the app does not host or distribute third-party
copyrighted content.
