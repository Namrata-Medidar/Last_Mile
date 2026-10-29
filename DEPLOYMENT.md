# Last Mile Connect — going live

## Docker deployment on a Linux VM

The deployment uses two running containers: `app` (the TanStack Start UI and server) and `nginx` (TLS termination and reverse proxy). Certbot is a one-shot service for certificate issuance/renewal, not a continuously running container. The existing Supabase project remains the backend; the database is not hosted in this Compose stack. Only Nginx publishes ports 80 and 443; the app is reachable only over the private Compose network. Nginx denies unknown hostnames by default.

### Domain and firewall prerequisites

- The configured domain is `lastmile.airowire.com`. It currently resolves to `20.198.89.213`; confirm this is the VM's public IP before issuing a certificate. Create/keep an `A` record pointing at the VM. Configure an `AAAA` record only if IPv6 is actually enabled and reachable on the VM.
- Install Docker Engine and the Docker Compose plugin. Nginx and Certbot run in containers, so they do not need to be installed on the VM.
- Allow inbound TCP ports 80 and 443 in the cloud firewall/security group. Keep SSH restricted to your administration network; do not expose port 3000. Docker-published ports can bypass some host firewall tooling such as UFW, so use cloud-level rules and Nginx access controls; configure the host's `DOCKER-USER` chain too if host-level filtering is required.
- Copy the repository to the VM, enter its root directory, and create the runtime configuration:

  ```sh
  cp .env.production.example .env.production
  chmod 600 .env.production
  ```

- Set the Supabase project URL/publishable key in both `VITE_*` and server-side variables, and put the service-role key only in `SUPABASE_SERVICE_ROLE_KEY`. Never use the service-role key in a `VITE_*` variable. These Supabase settings remain the same when the app gets a domain.

### Issue the initial Let's Encrypt certificate

The normal Nginx config references the certificate files, so do not start the normal `nginx` service until Certbot has issued the certificate. Start the temporary HTTP-only Nginx bootstrap service first:

```sh
docker compose --env-file .env.production --profile bootstrap up -d nginx-bootstrap
docker compose --env-file .env.production --profile certbot run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d lastmile.airowire.com \
  --email YOUR-RENEWAL-EMAIL --agree-tos --no-eff-email
```

Replace `YOUR-RENEWAL-EMAIL` with an email address monitored for certificate expiry notices. Certbot's certificate and ACME account data persist in the Compose `letsencrypt` volume; challenge files use the shared `certbot_webroot` volume. The domain must resolve to this VM and port 80 must be reachable from the public internet for HTTP-01 validation.

After Certbot succeeds, stop/remove the bootstrap server, configure the initial admin access rule, validate the production Nginx config, then start app and Nginx:

```sh
docker compose --env-file .env.production --profile bootstrap rm -sf nginx-bootstrap
```

Before public signup, edit `deploy/nginx/default.conf` and add an allow rule inside the TLS `location /`, immediately above `deny all;`. For example, use `allow YOUR_ADMIN_PUBLIC_IP/32;` or your VPN CIDR. Keep `deny all;` below the allow rule. The app grants Super Admin to the first account created, so do not remove this gate until the intended admin account is created and secured. If users already exist in Supabase, verify the existing admin role instead of assuming this server's first visitor is the first account.

Validate and launch:

```sh
docker compose --env-file .env.production run --rm --no-deps --entrypoint nginx nginx -t
docker compose --env-file .env.production up -d --build
docker compose ps
docker compose logs --tail=100 app nginx
```

The app is built for Nitro's Node server preset. It runs as the unprivileged Node user with a read-only filesystem. Nginx uses an internal listener, a read-only filesystem, and the private Compose network to proxy requests to `app:3000`. Only Nginx publishes ports 80/443.

Visit `https://lastmile.airowire.com`. HTTP redirects to HTTPS, and Let's Encrypt provides a publicly trusted certificate, so users do not need to install a private CA.

### Certificate renewal and Supabase Auth

Configure a daily host cron/systemd timer (Certbot only renews when the certificate is due). Edit root's crontab using `sudo crontab -e` and add this line, replacing the project path:

```cron
17 3 * * * cd /path/to/Last_Mile && docker compose --env-file .env.production --profile certbot run --rm certbot renew && docker compose --env-file .env.production exec -T nginx nginx -s reload >> /var/log/last-mile-certbot-renew.log 2>&1
```

Verify renewal with:

```sh
docker compose --env-file .env.production --profile certbot run --rm certbot renew --dry-run
```

The renewal command reloads Nginx even when no renewal was due; this is safe and avoids granting Certbot access to the Docker socket. Keep inbound port 80 reachable so HTTP-01 renewal can work.

In Supabase Dashboard → Authentication → URL Configuration, set Site URL to `https://lastmile.airowire.com` and add `https://lastmile.airowire.com/**` to allowed redirect URLs. The app's sign-up, login, and password-reset redirects use the browser's current origin. Apply database migrations to the existing Supabase project through the established migration process; Compose does not initialize or migrate the database.

### Operate and update

```sh
docker compose logs -f app nginx
docker compose --env-file .env.production up -d --build
```

Keep `.env.production` mode `600` and restricted to VM administrators. Compose passes its values into the app container environment; anyone with root or Docker-daemon access can inspect them. Do not grant application users Docker access or mount the Docker socket. For stronger production secret management, use a managed secrets platform or orchestration secrets integration rather than treating a Compose env file as a vault. Protect the VM with timely OS/container updates, host firewalling, SSH key authentication, monitoring, and tested backups. Do not commit the production environment file or expose the Supabase service-role key.

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
- Before uploading booking attachments, run the full `drizzle/migrations/0008_booking_attachments.sql` script in the Supabase SQL Editor. It reuses the existing `booking_attachments` table, creates the private Storage bucket, and configures booking-scoped access policies. It is safe to rerun if the table already exists.
- If an existing `booking_attachments` table still rejects metadata inserts with a row-level security error, run `drizzle/migrations/0009_booking_attachments_rls.sql` in the Supabase SQL Editor to replace that table's conflicting policies with booking-scoped policies.

## 4. Security notes
- Roles are stored separately and checked on the server; every table has row-level access rules.
- Engineer assignment, job progress, ratings, role changes and payments run only through server-side database functions.
- Internal database helpers are not callable from the app; public visitors can only read the active catalogue and prices.
- Every change to bookings, roles and payments is written to the change history.

## 5. Known limitations
- Booking form doesn't capture city yet, so same-city matching applies only to team-created orders.
- Customer price is calculated in the browser from built-in values; admin price edits apply once the calculator reads settings.
- Some older screens are still loosely typed (marked `@ts-nocheck`) and will be tightened incrementally.
