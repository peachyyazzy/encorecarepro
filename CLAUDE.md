# CLAUDE.md

Guidance for Claude Code / AI assistants working on this repo.

## Project shape

Turborepo monorepo with:

- `apps/web` — Next.js 15 app router; facility portal + admin dashboard
- `apps/mobile` — Expo Router; rider/family iOS+Android app
- `packages/shared` — NEMT billing logic, validators, types
- `packages/database` — Supabase client factories, generated types
- `supabase/migrations` — schema + RLS

## Rules of the road

1. **PHI is sacred.** Every table containing patient data has RLS enabled. Default is deny. Never disable RLS to "fix" a query — instead, write the right policy or use the service-role client inside a validated server route. The service-role key must never reach a browser or mobile app.

2. **Invoices vs. claims are distinct outputs.**
   - Private-pay → generate an **invoice** (a claim-ready superbill) and let the rider submit it themselves.
   - Care-plan (`medicaid` / `medicare` / `mco` / `waiver_program` / `va` / `workers_comp`) → generate a **claim** and submit to the payer through the clearinghouse.
   - `shared.types.requiresClaim(payerType)` tells you which path to take.

3. **HCPCS codes are law.** `packages/shared/src/billing/hcpcs.ts` is the source of truth. When adding pricing or invoice generation, always pull from here — don't hard-code codes inline.

4. **Origin/destination modifiers are required** on most NEMT claims. They live on `trips.origin_modifier` and `trips.destination_modifier` as `location_modifier` enum values. Concatenate with `buildOriginDestinationModifier`.

5. **Never send PHI to Google Maps.** Geocode addresses, not patient names. If you need a named place, send it abstractly (facility name or type, not "<Patient> + appointment").

6. **Server-side validation is non-optional.** Zod schemas in `packages/shared/src/validators` are used on both web API routes and mobile. Run them before any DB write.

7. **Audit every PHI write.** API routes that create/update patients, trips, invoices, claims should insert a row into `phi_access_log` describing the actor, action, resource. Service role handles the insert (the RLS policy only allows self-inserts from authenticated users for read-like actions).

8. **Mobile token storage** uses `expo-secure-store` (Keychain / EncryptedSharedPreferences). Do not switch to AsyncStorage on native — it's plaintext on disk.

9. **Trip state machine** is enforced in code. Valid transitions:
   - `requested` → `scheduled` → `assigned` → `driver_en_route` → `driver_arrived` → `in_progress` → `dropped_off` → `completed`
   - Any state → `canceled` (before pickup) or `no_show` (after arrival)
   - Write trip state changes through a helper (to be added in v1) that also inserts a `trip_events` row.

10. **Recurring schedules** are templates, not trips. A cron/edge function materializes trips N days ahead and updates `last_generated_through`. Don't insert trips directly from the `recurring_schedules` row.

11. **Stripe is the source of truth for payment state, not the client.** Client calls kick off Checkout/PaymentSheet, but the trip's `payment_status` only flips via `/api/webhooks/stripe`. Never mark a trip `paid` from a client-side callback. Every payment-creating call uses an idempotency key (`checkout:<tripId>`, `pi:<tripId>`) so retries are safe.

## Before committing

- `pnpm typecheck` across all workspaces
- `pnpm lint`
- Never commit `.env`, `.env.local`, or any secret. `.env.example` only.
- Do not commit generated `packages/database/src/generated.ts` if it contains a real Supabase URL/project ref — those are fine in env, not in code.

## Common tasks

- **Add a column to an existing table**: new migration file in `supabase/migrations/` with a timestamped name. Never edit an applied migration. After `supabase db reset`, run `pnpm db:types` to regenerate.
- **Add an RLS policy**: same — new migration. Keep helper functions in `20260423000002_rls_policies.sql`'s style (security definer, stable).
- **Add a billing code**: update `HCPCS` map in `packages/shared/src/billing/hcpcs.ts`, then adjust `defaultHcpcsForMobility` if needed.

## Current state

v0 scaffold. Booking flows are wired end-to-end at a basic level (mobile and facility web both write to `trips`). Missing for launch:

- Places autocomplete + Distance Matrix (loaded miles + pricing)
- Stripe checkout for private-pay
- PDF invoice generation
- Clearinghouse integration for claims
- Driver app flows
- Recurring schedule materializer (edge function)
- Push notifications
- Audit log wiring inside API routes

See `README.md` for the detailed roadmap.
