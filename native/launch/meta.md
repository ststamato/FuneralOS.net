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

## Export compliance (Apple — asked on every build upload)

FuneralOS uses only standard HTTPS/TLS (via Supabase, RevenueCat, Firebase,
Lemon Squeezy) — no proprietary or non-exempt encryption. Answer:

> **Does your app use encryption?** Yes
> **Does your app qualify for any of the exemptions provided in
> Category 5, Part 2 of the U.S. Export Administration Regulations?** Yes
> (exempt — standard encryption used only for authentication/data transport)

This is the standard answer for apps that only call HTTPS APIs; no export
compliance documentation (CCATS/self-classification report) is required
beyond checking this box. Confirm current wording in App Store Connect at
submission time — Apple periodically rewords this screen.

## Content rights (both stores)

FuneralOS owns or licenses all rights to the content in the app (UI text,
icon, illustrations). Case data, documents and photos are entered by the
customer's own office — the app does not host or distribute third-party
copyrighted content.
