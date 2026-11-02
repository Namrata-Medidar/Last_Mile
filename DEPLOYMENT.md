# Last Mile Connect — going live

## 1. Before publishing

- Sign up first: the first account becomes Super Admin.
- In Admin & operations → Prices, confirm rates, priorities and fees.
- Confirm the engineer payout share (currently 60%, an assumption).
- Replace placeholder company details on the invoice page (GSTIN, address) once provided.
- After applying the account-approval migration, new registrations remain pending until a Super Admin approves them. Existing active accounts are not changed.

## 2. Publish

- Click **Publish** in the editor. The app and backend go live together.
- Optional: connect a custom domain from Project settings → Domains.

## 3. After publishing

- Invite staff: they sign up, then a Super Admin/Admin grants roles in Admin & operations → Users.
- Engineers register from the Engineer portal; approve them in Engineers & dispatch.
- Payments are recorded by staff (bank transfer, UPI, cheque, cash, card). Online gateway (Razorpay) can be added with your keys.
- Before uploading booking attachments, run the full `drizzle/migrations/0008_booking_attachments.sql` script in the Supabase SQL Editor. It reuses the existing `booking_attachments` table, creates the private Storage bucket, and configures booking-scoped access policies. It is safe to rerun if the table already exists.
- If an existing `booking_attachments` table still rejects metadata inserts with a row-level security error, run `drizzle/migrations/0009_booking_attachments_rls.sql` in the Supabase SQL Editor to replace that table's conflicting policies with booking-scoped policies.
- To sync users assigned the Engineer role into the engineer directory and enable permission-based ticket assignment, run `drizzle/migrations/0018_role_engineer_ticket_assignment.sql` in the Supabase SQL Editor.
- To require Super Admin approval for new accounts, run `drizzle/migrations/0019_user_account_approval.sql` in the Lovable Cloud database SQL editor.
- To configure cancellation fees and free-cancellation timing per customer, run `drizzle/migrations/0020_customer_cancellation_policies.sql` after `0019` in the Lovable Cloud database SQL editor. Super Admins can then edit each customer's fee and choose whether the free period is measured after booking or before the scheduled visit. Customers see the applicable terms; cancellation does not collect a payment.
- To allow customers to cancel open bookings after an engineer has been assigned, run `drizzle/migrations/0021_allow_cancellation_after_assignment.sql` in the Lovable Cloud database SQL editor. In-progress and closed tickets remain non-cancellable.
- To allow cancellation of assigned/in-progress bookings and optionally save a customer message visible in the ticket conversation to staff and the assigned engineer, run `drizzle/migrations/0022_booking_cancellation_message.sql` after `0021` in the Lovable Cloud database SQL editor.
- To enable User Management bulk upload, deploy the Edge Function from the project root using `npx supabase login`, `npx supabase link --project-ref tvztrfoiqcbdvsblkbdq`, then `npx supabase functions deploy bulk-create-users`. The function is configured with `verify_jwt = false` so the gateway allows the browser's CORS preflight; the function itself validates the bearer token with Supabase Auth and enforces the role-assignment permission before any account creation. Keep this authentication check in place. Verify the function appears as deployed in Supabase → Edge Functions and that its logs show no startup error. The function uses Supabase's built-in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` secrets. Never expose the service-role key to the browser. The function creates confirmed accounts without sending email. The super admin must download and securely share each user's initial password; closing the result dialog clears passwords from the page.

## 4. Security notes

- Roles are stored separately and checked on the server; every table has row-level access rules.
- Engineer assignment, job progress, ratings, role changes and payments run only through server-side database functions.
- Internal database helpers are not callable from the app; public visitors can only read the active catalogue and prices.
- Every change to bookings, roles and payments is written to the change history.

## 5. Known limitations

- Booking form doesn't capture city yet, so same-city matching applies only to team-created orders.
- Customer price is calculated in the browser from built-in values; admin price edits apply once the calculator reads settings.
- Some older screens are still loosely typed (marked `@ts-nocheck`) and will be tightened incrementally.
