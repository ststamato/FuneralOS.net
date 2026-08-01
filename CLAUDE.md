# FuneralOS — Οδηγός Συνεργάτη (CLAUDE.md)

> Διαβάζεται σε **κάθε** session του Claude / Cowork. Είναι το «εγχειρίδιο» ώστε ο
> βοηθός να δουλεύει σαν έμπιστος συνεργάτης του FuneralOS: να καταλαβαίνει το
> προϊόν, να ακολουθεί τους κανόνες, να λύνει προβλήματα με ασφάλεια, και — όταν
> κάτι είναι ασαφές ή ριψοκίνδυνο — να **ρωτάει** ή να **προγραμματίζει** αντί να
> μαντεύει. Ο ιδιοκτήτης (Stavros) δεν είναι προγραμματιστής: εξήγησε απλά, στα
> ελληνικά, βήμα-βήμα.

## Τι είναι
**FuneralOS** (funeralos.net) — **SaaS** διαχείρισης γραφείου τελετών: τελετές,
αποθήκη, προμηθευτές/παραγγελίες, ειδοποιήσεις, ομάδες (teams), συνδρομές
(freemium/Pro/Team), σε **4 γλώσσες** (GR/EN/ES/IT). Multi-tenant: κάθε χρήστης έχει
δικά του δεδομένα. Πρωτεύουσα συσκευή: **iPhone** (PWA, «Add to Home Screen»).

## ⚠️ Πηγή αλήθειας & git κανόνες (ΔΙΑΒΑΣΕ ΠΡΩΤΑ)
- **`main` = η πραγματική, ενημερωμένη έκδοση του FuneralOS.** Δούλευε πάντα από το
  `main`.
- **ΠΑΝΤΑ `git pull` πριν το push. ΠΟΤΕ force-push σε κοινό branch.** Πολλά Cowork
  sessions δουλεύουν παράλληλα· force-push έχει ήδη «σβήσει» δουλειά στο παρελθόν.
  Αν το push απορριφθεί → `git pull --rebase`, λύσε conflicts, ξανα-push.
- Νέα δουλειά σε feature branch → **Pull Request στο `main`** (όχι απευθείας push σε
  main χωρίς έγκριση). Μη δημιουργείς PR χωρίς να το ζητήσει ο χρήστης.
- Το παλιό «Σταυρακάκη» single-file app **ΔΕΝ** είναι το project — αγνόησέ το.

## Χάρτης repo
- `saas/` — **deployable web root** (στατικά, Cloudflare Pages):
  - `app.html` + `app.js` (~7.4k γρ.) + `styles.css` — η εφαρμογή/PWA
  - `suppliers.js` (module προμηθευτών), `sw.js` (service worker/push),
    `freemium.js`, `usa.js`
  - `index.html` (landing), `admin.html`, `login.html`, `reset.html`,
    `success.html`, `status.html`, `privacy.html`, `terms.html`
  - Γλώσσες: **GR στη ρίζα `saas/`**, **EN στο `saas/en/`**, επίσης `es/`, `it/`
  - `manifest.webmanifest`, `_redirects`, `_headers`, `robots.txt`, `sitemap.xml`
  - `config.example.js` → αντιγράφεται σε **`config.js`** (Stripe links + GA4). Το
    `config.js` **δεν** μπαίνει στο git.
- `supabase/` — `setup.sql` (**authoritative schema/RLS**) + `functions/`:
  - `ai-assistant` — AI βοηθός: **xAI Grok** (`grok-3-mini`, `https://api.x.ai`),
    με **server-side rate limiting**. Secret: `XAI_API_KEY`. (Πληρωμένο API.)
  - `push_sender` — Web Push (VAPID) **ανά χρήστη** (διαβάζει `app_state` id=userId).
    Secret: `VAPID_PRIVATE_KEY` (+ auto `SUPABASE_URL`/`SERVICE_ROLE_KEY`).
  - `team-invite`, `accept-invite` — προσκλήσεις ομάδας
  - `admin-stats` — στατιστικά admin
  - `lemon-webhook` — Lemon Squeezy billing
- `netlify/functions/` — `stripe-webhook`, `lemon-webhook`. `netlify.toml` υπάρχει —
  μάλλον **legacy**· το ενεργό hosting φαίνεται **Cloudflare Pages** (τα `_redirects`/
  `_headers` και τα πρόσφατα commits είναι Cloudflare-specific). *Επιβεβαίωσέ το.*
- `admin-panel/` — ξεχωριστό admin UI.

## Deploy
- **Hosting: Cloudflare Pages** (funeralos.net), publish root = `saas/`. Routing via
  `saas/_redirects`, headers via `saas/_headers`. ⚠️ Το routing είναι **εύθραυστο** —
  πολλά παλιά bugs ήταν **redirect loops** (Cloudflare Pretty URLs). Άλλαξέ το με
  μεγάλη προσοχή και κράτα GR/EN συμμετρικά.
- Backend: **Supabase**. Schema/RLS: `supabase/setup.sql`. Edge functions γίνονται
  deploy από Supabase (Dashboard «Deploy a new function» ή `supabase functions
  deploy <name>`). Secrets: Supabase → Edge Functions → Secrets.

## Συμβάσεις stack (Stavros)
- Στατικά αρχεία, **χωρίς build/bundler/framework**. Vanilla JS· βιβλιοθήκες μόνο από
  CDN `<script>`. Supabase JS από CDN.
- **iPhone-first PWA**: `viewport-fit=cover`, `env(safe-area-inset-*)`, touch ≥44px,
  inputs ≥16px (όχι iOS zoom), installable/standalone.
- **UI στα Ελληνικά** by default (identifiers στα Αγγλικά). Κράτα **EN/ES/IT
  συμμετρικά** με το GR όταν αλλάζεις UI/flow.
- Όταν αλλάζεις υπάρχον αρχείο, **επίστρεψε ΟΛΟΚΛΗΡΟ το αρχείο**, όχι diff.
- Ship τη **στενότερη χρήσιμη έκδοση** πρώτα, μετά iterate.

## 🔒 Ασφάλεια — ΠΟΤΕ μη διαρρεύσεις κλειδιά (κρίσιμο)
- Στον client (`saas/`) επιτρέπονται ΜΟΝΟ: Supabase URL + **anon** key (με RLS),
  δημόσια Stripe payment links, GA4 id, VAPID **public** key.
- **ΠΟΤΕ** στον client: `service_role` key, VAPID **private**, Stripe/Lemon secret,
  `XAI_API_KEY`, ή άλλο μυστικό. Αυτά ζουν ΜΟΝΟ ως secrets σε Edge Functions.
- RLS **ενεργό σε ΟΛΑ τα tables** (ο anon key είναι ασφαλής μόνο έτσι).
- Ιστορικό: κάποτε διέρρευσε private key και χρειάστηκε revoke. Αν δεις secret σε
  client αρχείο ή στο git, **σταμάτα και ειδοποίησε για rotation αμέσως**.

## Push Notifications
- Client: `saas/sw.js` + εγγραφή με **VAPID public** (`saas/app.js`). Server:
  `push_sender` με VAPID **private**.
- ⚠️ Το VAPID **public** (client) ΠΡΕΠΕΙ να ταιριάζει με το ζευγάρι του private
  (server). Κατάσταση στο `main`: **συγχρονισμένο** ✅ (commit «Rotate VAPID key
  pair»). **Αν ξανα-αλλάξεις κλειδιά, κράτα τα συγχρονισμένα** — αλλιώς τα push
  αποτυγχάνουν σιωπηλά και όλοι πρέπει να ξανα-εγγραφούν.
- iOS: μόνο 16.4+ και **εγκατεστημένη** PWA.

## Χρυσοί κανόνες αλλαγών (μη σπάσεις την production)
1. **Προσθετικά όποτε γίνεται** (νέα modules/αρχεία αντί για ξαναγράψιμο μεγάλων).
2. Μετά από αλλαγή, **επικύρωσε** (βλ. «Έλεγχοι») πριν push/PR.
3. Routing (`_redirects`) εύθραυστο → απόφυγε redirect loops.
4. Κράτα GR/EN/ES/IT **συμμετρικά**.
5. **Καμία** αλλαγή σε πληρωμές/webhooks/RLS/τιμές χωρίς ρητή έγκριση.

## Έλεγχοι πριν την παράδοση (health checks)
```bash
# Σύνταξη JS (κάθε αρχείο που άγγιξες)
node -c saas/app.js && node -c saas/suppliers.js && node -c saas/sw.js && node -c saas/freemium.js
# Σάρωση για κατά λάθος secrets στον client (πρέπει να ΜΗΝ βγάζει τίποτα)
grep -rInE "service_role|sk_live|sk_test|xai-[A-Za-z0-9]|VAPID_PRIVATE|BEGIN (RSA |EC )?PRIVATE KEY" saas/ || echo "OK"
# VAPID public: client vs server (πρέπει να ταιριάζουν)
grep -A2 VAPID_PUBLIC_KEY saas/app.js supabase/functions/push_sender/index.ts
```
- Edge functions (TS/Deno): `npx esbuild <file> --bundle --format=esm --platform=neutral --external:npm:* --outfile=/dev/null`.

## Πώς να δουλεύεις σαν συνεργάτης (η φιλοσοφία που θέλει ο Stavros)
- Στην αρχή: `git pull` από `main`, κατάλαβε τι ζητά, βρες τα σχετικά αρχεία, κάνε
  **ασφαλή, στοχευμένη** αλλαγή, **επικύρωσε**, εξήγησε σύντομα τι/γιατί.
- **Λύσε τα προβλήματα**: αν βρεις bug/κίνδυνο, διόρθωσέ το· αν είναι ριψοκίνδυνο
  (κλειδιά, πληρωμές, schema, διαγραφές, force-push), **ρώτησε πρώτα**.
- **Ρώτα ή προγραμμάτισε**: για αποφάσεις ρώτησε· για επαναλαμβανόμενες εργασίες
  (π.χ. εβδομαδιαίος έλεγχος υγείας/ασφαλείας) πρότεινε προγραμματισμό.
- Παράδωσε ολοκληρωμένα αρχεία και άνοιξε PR στο `main` (με έγκριση).

## Ανοιχτά προς επιβεβαίωση
- Hosting: Cloudflare Pages vs Netlify (φαίνεται Cloudflare· `netlify.toml` legacy;).
- Ποια edge functions είναι live στο Supabase και ποια secrets έχουν οριστεί
  (`XAI_API_KEY`, `VAPID_PRIVATE_KEY`, Lemon signing secret, κ.λπ.).
