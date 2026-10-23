create sequence public.booking_ticket_seq start 1000;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique default ('FE-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.booking_ticket_seq')::text, 5, '0')),
  customer_id uuid not null,
  service_slug text not null default 'field-engineer-support',
  title text not null,
  priority text not null default 'Medium',
  city text,
  customer_name text,
  site_address text,
  engineer_name text not null default 'Unassigned',
  engineer_phone text,
  progress int not null default 12 check (progress between 0 and 100),
  total numeric(12,2) check (total >= 0),
  details jsonb not null default '{}'::jsonb,
  last_contact text,
  status text not null default 'Open' check (status in ('Open','In Progress','Closed','Cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create index bookings_customer_idx on public.bookings (customer_id, created_at desc);
create index bookings_status_idx on public.bookings (status, priority);
grant usage on sequence public.booking_ticket_seq to authenticated;
grant select, insert, update on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;
create policy "Customers read own bookings" on public.bookings for select to authenticated using (customer_id = auth.uid() or public.is_staff(auth.uid()));
create policy "Customers create own bookings" on public.bookings for insert to authenticated
  with check (customer_id = auth.uid() and status = 'Open' and engineer_name = 'Unassigned');
create policy "Staff update bookings" on public.bookings for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event text not null,
  from_status text,
  to_status text,
  note text,
  status text not null default 'recorded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create index booking_events_booking_idx on public.booking_events (booking_id, created_at);
grant select on public.booking_events to authenticated;
grant all on public.booking_events to service_role;
alter table public.booking_events enable row level security;
create policy "Read events of visible bookings" on public.booking_events for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and (b.customer_id = auth.uid() or public.is_staff(auth.uid()))));

create table public.booking_comments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  author_id uuid not null default auth.uid(),
  author_name text not null,
  author_role text not null,
  visibility text not null default 'public' check (visibility in ('public','internal')),
  body text not null check (char_length(body) between 1 and 4000),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create index booking_comments_booking_idx on public.booking_comments (booking_id, created_at);
grant select, insert on public.booking_comments to authenticated;
grant all on public.booking_comments to service_role;
alter table public.booking_comments enable row level security;
create policy "Read comments" on public.booking_comments for select to authenticated using (
  public.is_staff(auth.uid())
  or (visibility = 'public' and exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid())));
create policy "Write comments" on public.booking_comments for insert to authenticated with check (
  author_id = auth.uid() and (
    public.is_staff(auth.uid())
    or (visibility = 'public' and exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid()))));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  booking_id uuid references public.bookings(id) on delete cascade,
  channel text not null default 'in_app' check (channel in ('in_app','email','sms','push')),
  event text not null,
  title text not null,
  detail text,
  read_at timestamptz,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "Own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Mark own read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Lifecycle: events, notifications, audit
create or replace function public.booking_lifecycle() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_events (booking_id, event, to_status, created_by) values (new.id, 'created', new.status, auth.uid());
    insert into public.notifications (user_id, booking_id, event, title, detail, created_by)
      values (new.customer_id, new.id, 'booking_created', 'Booking ticket created', new.ticket_no || ' · Assignment pending', auth.uid());
  else
    if new.engineer_name is distinct from old.engineer_name and new.engineer_name <> 'Unassigned' then
      insert into public.booking_events (booking_id, event, note, created_by) values (new.id, 'engineer_assigned', new.engineer_name, auth.uid());
      insert into public.notifications (user_id, booking_id, event, title, detail, created_by)
        values (new.customer_id, new.id, 'driver_assigned', 'Engineer assigned', new.ticket_no || ' · ' || new.engineer_name, auth.uid());
    end if;
    if new.status is distinct from old.status then
      insert into public.booking_events (booking_id, event, from_status, to_status, created_by) values (new.id, 'status_changed', old.status, new.status, auth.uid());
      insert into public.notifications (user_id, booking_id, event, title, detail, created_by)
        values (new.customer_id, new.id,
          case new.status when 'In Progress' then 'ride_started' when 'Closed' then 'ride_completed' else 'status_changed' end,
          case new.status when 'In Progress' then 'Work started' when 'Closed' then 'Service completed' else 'Booking ' || lower(new.status) end,
          new.ticket_no, auth.uid());
    end if;
  end if;
  return new;
end $$;
create trigger bookings_lifecycle after insert or update on public.bookings for each row execute function public.booking_lifecycle();
create trigger bookings_updated before update on public.bookings for each row execute function public.set_updated_at();
create trigger audit_bookings after insert or update on public.bookings for each row execute function public.audit_row();
create trigger notifications_updated before update on public.notifications for each row execute function public.set_updated_at();

-- Staff comments notify the customer (public only)
create or replace function public.comment_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = new.booking_id;
  if new.visibility = 'public' and new.author_id <> b.customer_id then
    insert into public.notifications (user_id, booking_id, event, title, detail, created_by)
      values (b.customer_id, b.id, 'comment', 'New reply on your ticket', b.ticket_no, new.author_id);
  end if;
  return new;
end $$;
create trigger booking_comments_notify after insert on public.booking_comments for each row execute function public.comment_notify();

alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.booking_comments;
alter publication supabase_realtime add table public.notifications;