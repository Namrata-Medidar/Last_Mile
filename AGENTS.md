<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Ported components from the original repo carry `// @ts-nocheck`; remove it when typing a file properly, never add it to new code. Why: incremental TS migration without breaking existing features.
- Price calculation lives only in src/lib/pricing.ts with tests in pricing.test.ts. Why: single source for quote rules.
- Data access goes through src/services/*Service.ts; components never call the database client directly. Why: one place for queries, retries and error handling.
- Roles live only in user_roles and are checked with has_role/is_staff in policies; the first account to sign up becomes super admin. Why: prevents privilege escalation and bootstraps admin access.
- Engineer assignment, job start\/complete, ratings and self-availability run as database functions (assign_engineer, engineer_job_action, rate_booking, set_my_availability); clients never update those booking fields directly. Why: business rules enforced server-side.
- Trigger and helper DB functions have EXECUTE revoked from anon/authenticated; only intended RPCs are granted to authenticated. Why: security-definer functions must not be callable from the API unless designed to be.
- Payments/refunds are recorded only via record_payment (staff); bookings.payment_status/amount_paid/invoice_no are never written by clients. Why: money state enforced server-side.
