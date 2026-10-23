-- Roles
create type public.app_role as enum ('super_admin','admin','ops_manager','engineer','customer');

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); new.updated_by = coalesce(auth.uid(), new.updated_by); return new; end $$;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  company text,
  address text,
  avatar_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role and status = 'active')
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and status = 'active'
    and role in ('super_admin','admin','ops_manager'))
$$;

create policy "Own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "Own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Admins update profiles" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));
create policy "Own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger user_roles_updated before update on public.user_roles for each row execute function public.set_updated_at();

-- New user: profile + customer role; very first user becomes super admin
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone, company, created_by)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'company',
    new.id);
  insert into public.user_roles (user_id, role, created_by) values (new.id, 'customer', new.id);
  if not exists (select 1 from public.user_roles where role = 'super_admin') then
    insert into public.user_roles (user_id, role, created_by) values (new.id, 'super_admin', new.id);
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Audit log
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  status text not null default 'recorded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create index audit_logs_entity_idx on public.audit_logs (entity, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "Admins read audit" on public.audit_logs for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));

create or replace function public.audit_row() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, old_data, new_data, created_by)
  values (auth.uid(), lower(tg_op), tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id', ''),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    auth.uid());
  return coalesce(new, old);
end $$;
create trigger audit_profiles after update on public.profiles for each row execute function public.audit_row();
create trigger audit_user_roles after insert or update or delete on public.user_roles for each row execute function public.audit_row();

-- Catalogue
create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  description text not null,
  image_key text not null default 'data-center',
  sort_order int not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table public.rate_cards (
  id uuid primary key default gen_random_uuid(),
  grade text not null unique,
  label text not null,
  card_code text not null,
  hourly numeric(12,2) not null,
  min_hours int not null,
  min_charge numeric(12,2) not null,
  off_hours_min numeric(12,2) not null,
  off_hours_hourly numeric(12,2) not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table public.priorities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  multiplier numeric(5,2) not null,
  dispatch_fee numeric(12,2) not null default 0,
  sla text not null,
  scheduled boolean not null default true,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  rate numeric(12,2) not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

do $$ declare t text; begin
  foreach t in array array['services','rate_cards','priorities','materials','system_settings'] loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Public read active" on public.%I for select to anon, authenticated using (status = ''active'' or public.is_staff(auth.uid()))', t);
    execute format('create policy "Admins manage" on public.%I for all to authenticated using (public.has_role(auth.uid(),''admin'') or public.has_role(auth.uid(),''super_admin'')) with check (public.has_role(auth.uid(),''admin'') or public.has_role(auth.uid(),''super_admin''))', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', 'audit_' || t, t);
  end loop;
end $$;

-- Seed: existing catalogue and pricing rules
insert into public.services (slug, title, category, description, image_key, sort_order) values
 ('field-engineer-support','Field Engineer Support','Field Engineer','Certified engineers for installation, configuration, troubleshooting, and on-ground support.','field-engineer',1),
 ('site-readiness-audit','Enterprise Site Readiness Audit','Site Audit','Physical, power, and connectivity readiness assessment.','site-audit',2),
 ('structured-cabling','Structured Cabling Build-Out','Passive Services','Cabling, terminations, and certification.','data-center',3),
 ('wifi-heatmap-survey','WiFi Predictive & Passive Heatmap Survey','Survey','Heatmaps, AP placement, and channel planning.','data-center',4),
 ('leased-line','Internet Leased Line Provisioning','ISP Gateway','Multi-ISP feasibility and last-mile delivery.','site-audit',5),
 ('managed-switch','Managed Switch Supply & Staging','Products & Inventory','Procure, configure, and deliver network equipment.','data-center',6);

insert into public.rate_cards (grade,label,card_code,hourly,min_hours,min_charge,off_hours_min,off_hours_hourly) values
 ('L1','L1 Engineer','RC-2026-FE-L1',1000,4,4000,6000,2000),
 ('L2','L2 Engineer','RC-2026-FE-L2',1500,4,6000,9000,2500);

insert into public.priorities (code,label,multiplier,dispatch_fee,sla,scheduled) values
 ('P0','P0 — Critical (High)',1.35,2500,'Engineer allotted in 15–20 min · on site within 2–3 hours',false),
 ('P1','P1 — High',1.15,1000,'Engineer allotted same day',true),
 ('P2','P2 — Standard',1.00,0,'Scheduled as per selected slot',true);

insert into public.materials (name,rate) values
 ('Cat6A cable (per box)',6500),('LC-LC patch cord',850),('Managed switch port module',3200),
 ('PVC conduit (per 10 m)',450),('Copper wire bundle',1200);

insert into public.system_settings (key,value,description) values
 ('platform_fee','200','Platform charge per booking (INR)'),
 ('amc_discount','1200','Discount for AMC-linked customers (INR)'),
 ('gst_rate','0.18','GST rate'),
 ('cancellation_fee','1000','Cancellation fee (INR)'),
 ('business_hours','{"start":8,"end":20}','Standard working hours');