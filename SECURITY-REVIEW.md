# Security Review

## UAT Hardening (2026-11-03)

This is a restricted-UAT assessment, not production security approval. Supabase Auth and the existing application architecture are retained. No new authentication provider, auth hook, dependency, or framework version was introduced.

### Implemented and verified locally

- Auth storage keeps only access/refresh tokens, expiry, and token type. The user object stays in memory; legacy user objects, provider tokens, and duplicate access-token entries are removed from the session storage record.
- Session recovery handles unavailable user objects and ignores stale recovery results after sign-out. Account switches and sign-out cancel queries and clear cached private data.
- Redirect input is checked before URL parsing. Unsafe or malformed destinations fall back to the home page. Signup responses and account identifiers are no longer logged by the auth service.
- Protected pages redirect missing/rejected sessions to sign-in, reject pending accounts, and preserve error handling for transient auth failures.
- Existing server middleware checks token shape, audience, authenticated role, and the matching user returned by Supabase Auth. This middleware protects only server functions that register it; browser data access continues to rely on Supabase RLS.
- The privileged server client refuses browser initialization and disables shared auth persistence and refresh.
- Attachments have a 10 MB limit and a MIME allowlist in the upload service and the existing rerunnable bucket setup script. Browser validation is not a security boundary; the bucket update must be applied to UAT. MIME checks are not malware scanning or content verification.
- Existing Nginx configuration adds a restrictive referrer policy, base/object/frame/form CSP directives, request timeouts, and replaces untrusted forwarded-IP input. The CSP does not constrain script execution and is not full XSS protection.

### Verification

- `npm test`: 79 tests passed across 13 files.
- `npm run build`: passed.
- Editor diagnostics: none in the checked changed source/test files.
- Browser smoke check on the existing local server: malformed login redirect renders safely; anonymous `/admin` redirects to `/auth?redirect=%2Fadmin` and displays sign-in.
- Repository-wide `npx tsc --noEmit` still fails on routing and generated database-type mismatches; this is not a clean repository-wide typecheck.
- Nginx and PostgreSQL changes were not executed locally: Docker is installed but its daemon is unavailable, and no local PostgreSQL/Nginx executable was found. No hosted configuration or database changes were applied.

### Remaining UAT Gates

1. Restrict the app and its development server to authorized UAT networks using the existing firewall/VPN/Nginx allowlist. The active Nginx location currently has no IP allowlist. Verify the intended Super Admin already exists before allowing signup; first-registrant promotion remains unchanged by repository convention.
2. Reapply `drizzle/migrations/0008_booking_attachments.sql` through the established database deployment process, or apply its bucket upsert separately to avoid changing existing policies. Verify the private bucket, 10 MB limit, and MIME allowlist in the deployed project. Existing files are not scanned or removed by this update.
3. Validate Nginx on the deployment host before reloading, and confirm HTTPS and the response headers. These headers do not apply to the standalone local Vite server or Supabase endpoints.
4. Test direct API access with separate customer, engineer, staff, and pending accounts. Verify cross-customer bookings/comments/files are denied, internal comments remain staff-only, and role/payment/job actions require their intended permissions. Do not use service-role credentials for these tests because they bypass RLS.
5. Verify hosted Supabase redirect URLs, password policy, rate limits, JWT lifetime, and refresh-token rotation. Client inactivity sign-out is not a server-enforced session lifetime; existing access tokens may remain valid until expiry after logout.
6. Use synthetic users, documents, and money values only. Browser-supplied booking pricing is not server-authoritative. Token storage is still JavaScript-readable, and personal metadata may remain inside JWTs because no token hook was introduced.
7. `npm audit --omit=dev` reports two high-severity advisories: Vite 8.1.5 and Zod 3.x. Dependency versions were deliberately kept unchanged at the user's request after the advisories were surfaced. Restriction to UAT reduces exposure but does not fix these advisories; do not approve unrestricted/public production release until they are resolved.

## Prior Review

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
