# Encore Care — NEMT

Non-emergency medical transportation (NEMT) booking platform.

- **Riders & family members** book trips from the iOS/Android app.
- **Healthcare facilities** schedule and manage trips for their patients from the web portal.
- **Admins & dispatchers** run operations, review claims, and manage drivers.
- **Private-pay** trips produce a claim-ready superbill the rider can submit.
- **Care-plan** trips (Medicaid, MCO, waiver, VA) are billed directly to the payer via a clearinghouse.

---

## Monorepo layout

```
apps/
  web/         Next.js 15 — facility portal + admin dashboard
  mobile/      Expo (React Native) — rider / family app
packages/
  shared/      Billing codes, types, validators, pricing
  database/    Supabase client factories + generated types
supabase/
  migrations/  SQL schema + RLS policies
```

---

## Prerequisites

- Node.js ≥ 20
- pnpm 10+
- Supabase CLI (`brew install supabase/tap/supabase`)
- Expo CLI via `npx expo`
- EAS CLI for app-store builds (`npm i -g eas-cli`)
- A Supabase project (with a signed BAA — see Compliance below)
- Stripe account (needs a BAA — Stripe offers it on request for healthcare customers). Add a webhook endpoint pointing to `https://<your-domain>/api/webhooks/stripe` and subscribe to: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `checkout.session.completed`, `charge.refunded`.
- Google Maps API key — enable **Places API**, **Maps JavaScript API**, and **Distance Matrix API**. Create three restricted keys:
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — HTTP-referrer-restricted to your web domains
  - `GOOGLE_MAPS_SERVER_KEY` — IP-restricted (or unrestricted, server-side only)
  - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — iOS bundle-ID + Android package-name restricted
- Clearinghouse account (Office Ally, Availity, or Waystar) — only required once you start submitting claims

---

## Quick start

```bash
pnpm install

# Start Supabase locally and apply migrations
supabase start
supabase db reset        # applies everything in supabase/migrations

# Generate typed DB client
pnpm db:types

# Copy env examples and fill in keys
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local

# Run web
pnpm web

# Run mobile (separate terminal)
pnpm mobile
```

---

## Roadmap

### Shipped in the scaffold (v0)
- Monorepo with Turborepo + pnpm workspaces
- Full Supabase schema for patients, trips, recurring schedules, invoices, claims, audit log
- RLS policies (default deny; role- and relationship-based)
- Shared package with NEMT HCPCS codes, origin/destination modifiers, pricing engine, claim builder
- Next.js facility portal shell: dashboard, trips, patients, schedules, invoices
- Next.js admin shell: operations, claims, dispatch, audit
- Expo mobile app shell: auth, tabs (book / trips / schedules / profile), booking flow
- Supabase email/password auth on both apps; tokens stored in Keychain/Keystore via `expo-secure-store`

### Next up (v1 — what you need before launching)
1. ~~**Google Places autocomplete** for address input + **Distance Matrix** to compute loaded miles.~~ ✅ Shipped.
2. ~~**Real pricing quotes** based on actual distance.~~ ✅ Shipped.
3. ~~**Stripe Checkout** for private-pay trips; webhook updates trip status.~~ ✅ Shipped (web Checkout + mobile PaymentSheet + `payment_intent.*` webhook handler).
4. **Driver dispatch app** (same Expo codebase, role-gated) — accept trip, en-route, arrived, start, complete.
5. **Recurring schedule trip generator** — cron/edge function that materializes upcoming trips from `recurring_schedules`.
6. **PDF invoice / superbill generator** — server-side React PDF rendering, stored in Supabase Storage.
7. **Clearinghouse integration** — map `claims` + `claim_service_lines` rows to 837P EDI via Office Ally / Availity / Waystar API.
8. **Real-time trip tracking** — Supabase Realtime channel per trip; push location updates to rider.
9. **Push notifications** (Expo Push) — driver assigned, en route, arrived, completed.
10. **Insurance card capture** — photo upload → Supabase Storage with short-lived signed URLs.

### Later
- Multi-rider trips, group billing
- Prior-authorization automation (per-state Medicaid portals)
- Facility SSO (SAML) + NPI verification
- 835 remittance parsing to auto-reconcile paid/denied claims
- Analytics (completion rate, on-time %, denial rate per payer)

---

## Compliance — important

NEMT touches **PHI**. Before production:

1. **Sign a BAA with Supabase** — required on the Team plan. Do not store PHI on a plan without a BAA.
2. **Sign BAAs with every subprocessor**: Stripe (Stripe Atlas Health BAA), Google Maps (does **not** sign BAA — never send PHI to Maps; scrub patient info before geocoding), Twilio (BAA available), your clearinghouse.
3. **Expo / EAS** — Expo itself does not handle PHI in transit, but **do not** put PHI in OTA updates or error tracking payloads. Configure Sentry (if used) with PII scrubbing.
4. **Audit log** — every PHI access/write writes to `phi_access_log`. Wire this from API routes; don't rely on client calls to log.
5. **Encryption at rest + in transit** — Supabase handles both. Confirm TLS 1.2+ on all clients.
6. **Minimum necessary** — RLS policies in `20260423000002_rls_policies.sql` enforce that facilities only see their own patients' trips; drivers only see trips they're assigned to; riders only see their own.
7. **Session timeout** — tune `jwt_expiry` per your risk appetite; the default 1h is a reasonable starting point for a patient-facing app.
8. **Device-level protection (mobile)** — tokens are stored in Keychain (iOS) / EncryptedSharedPreferences (Android) via `expo-secure-store`. Consider adding biometric re-auth (expo-local-authentication) before viewing PHI.
9. **Breach notification plan** — have one ready. HHS has a 60-day clock.

NEMT-specific:
- State Medicaid programs vary dramatically. Confirm covered HCPCS, required modifiers, prior-auth rules, and trip-leg reconciliation for each state you operate in.
- Brokers (ModivCare, MTM, Access2Care, Veyo) each have their own submission portals/APIs. If you contract under a broker, submit to the broker, not the MCO directly.
- For Medicare trips, confirm the plan actually covers NEMT (most Original Medicare does **not**; many Medicare Advantage plans do).

---

## App store / Play Store checklist

iOS
- Apple Developer account ($99/yr).
- App Review will ask for a HIPAA attestation if you describe the app as medical. Be ready with your BAAs and security posture.
- `NSLocationWhenInUseUsageDescription` already set in `app.json`.

Google Play
- Play Console account ($25 one-time).
- Declare Health & Fitness data type in Data Safety form.
- Fine location permission requires a runtime disclosure.

Build:
```bash
cd apps/mobile
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

---

## License

Proprietary. © Encore Care.
