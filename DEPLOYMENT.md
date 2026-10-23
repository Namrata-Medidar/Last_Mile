# Last Mile Connect — going live

## 1. Before publishing
- Sign up first: the first account becomes Super Admin.
- In Admin & operations → Prices, confirm rates, priorities and fees.
- Confirm the engineer payout share (currently 60%, an assumption).
- Replace placeholder company details on the invoice page (GSTIN, address) once provided.

## 2. Publish
- Click **Publish** in the editor. The app and backend go live together.
- Optional: connect a custom domain from Project settings → Domains.

## 3. After publishing
- Invite staff: they sign up, then a Super Admin/Admin grants roles in Admin & operations → Users.
- Engineers register from the Engineer portal; approve them in Engineers & dispatch.
- Payments are recorded by staff (bank transfer, UPI, cheque, cash, card). Online gateway (Razorpay) can be added with your keys.

## 4. Security notes
- Roles are stored separately and checked on the server; every table has row-level access rules.
- Engineer assignment, job progress, ratings, role changes and payments run only through server-side database functions.
- Internal database helpers are not callable from the app; public visitors can only read the active catalogue and prices.
- Every change to bookings, roles and payments is written to the change history.

## 5. Known limitations
- Booking form doesn't capture city yet, so same-city matching applies only to team-created orders.
- Customer price is calculated in the browser from built-in values; admin price edits apply once the calculator reads settings.
- File attachments on orders are not stored.
- Some older screens are still loosely typed (marked `@ts-nocheck`) and will be tightened incrementally.
