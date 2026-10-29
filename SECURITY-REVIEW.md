# Security Review

Review date: 2026-10-29

## Findings

### HIGH — First registrant can become super-admin

- **Location:** `drizzle/migrations/0000_migration.sql:61-77`
- **Confidence:** 9/10
- **Issue:** The auth-user trigger grants `super_admin` to the new user whenever no super-admin assignment exists. Public signup is available, so on a fresh or otherwise uninitialized database the first person to register can gain administrative privileges.
- **Recommendation:** Remove first-registrant promotion. Provision the initial administrator through a controlled, out-of-band setup process. Public signup should never grant privileged roles.

### MEDIUM — Client-supplied booking total is trusted

- **Location:** `src/services/bookingService.ts:148-177`
- **Confidence:** 9/10
- **Issue:** Booking creation persists `b.totalPayable ?? b.total` supplied by the browser. The customer booking insert policies enforce ownership and initial booking state, but do not validate or recompute the price. A customer can submit an arbitrary or zero total, which can affect booking and invoice amounts.
- **Recommendation:** Calculate and validate prices in a trusted server-side function using database-controlled rates. Do not treat client-supplied totals as authoritative.

## Review scope

Reviewed authentication and routing, client/server Supabase boundaries, booking and payment services, attachment flows, notification routing, and database migrations for row-level security, role authorization, and storage policies. No external systems or network services were contacted.

## Validation and coverage

- `npm run build`: passed.
- `npm test`: 11 tests passed across 4 test files.
- Existing tests cover routing, pricing, engineer earnings, and admin summaries. No end-to-end or live-backend tests were run. Signup/bootstrap, RLS enforcement, booking price tampering, payment recording, file access, and notification navigation remain untested as integrated workflows.
- `npx tsc --noEmit`: failed with 36 diagnostics, primarily because generated Supabase types do not match columns and RPCs used by the app.
- `npm run lint`: failed with 10,440 diagnostics across 112 files; 10,419 are Prettier formatting diagnostics.

## Suggested improvements

1. Remove the first-user super-admin bootstrap and document a controlled administrator-provisioning process.
2. Move price calculation and booking creation to a trusted server-side operation; test tampered prices.
3. Regenerate Supabase types from the deployed schema and use type-checking in CI.
4. Add end-to-end tests for authentication, permission/RLS boundaries, booking lifecycle, payment operations, attachment access, and notification-to-ticket navigation.
5. Normalize formatting and configure lint checks so CI reports actionable changes without overwhelming formatting noise.
