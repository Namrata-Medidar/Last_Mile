create table public.engineers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  full_name text not null,
  phone text,
  grade text not null default 'L1' check (grade in ('L1','L2')),
  mode text not null default 'Both' check (mode in ('Active','Passive','Both')),
  city text not null,
  kit text,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected','suspended')),
  available boolean not null default true,
  max_active_jobs int not null default 2 check (max_active_jobs between 1 and 10),
  rating numeric(3,2) not null default 0,
  ratings_count int not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create index engineers_pool_idx on public.engineers (approval_status, available, grade, city);
grant select, insert, update on public.engineers to authenticated;
grant all on public.engineers to service_role;
alter table public.engineers enable row level security;

alter table public.bookings add column engineer_id uuid references public.engineers(id) on delete set null;
alter table public.bookings add column customer_rating int check (customer_rating between 1 and 5);
alter table public.bookings add column customer_feedback text;
alter table public.bookings add column started_at timestamptz;
alter table public.bookings add column completed_at timestamptz;
create index bookings_engineer_idx on public.bookings (engineer_id, status);

create or replace function public.my_engineer_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from public.engineers where user_id = auth.uid() and approval_status = 'approved'
$$;

create policy "Engineer reads own record" on public.engineers for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "Apply as engineer" on public.engineers for insert to authenticated
  with check (user_id = auth.uid() and approval_status = 'pending');
create policy "Staff manage engineers" on public.engineers for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "Engineers read assigned jobs" on public.bookings for select to authenticated using (engineer_id is not null and engineer_id = public.my_engineer_id());
create policy "Engineers read job comments" on public.booking_comments for select to authenticated
  using (visibility = 'public' and exists (select 1 from public.bookings b where b.id = booking_id and b.engineer_id = public.my_engineer_id()));
create policy "Engineers read job events" on public.booking_events for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.engineer_id = public.my_engineer_id()));

create trigger engineers_updated before update on public.engineers for each row execute function public.set_updated_at();
create trigger audit_engineers after insert or update on public.engineers for each row execute function public.audit_row();

-- Approval grants/revokes the engineer role
create or replace function public.engineer_role_sync() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then return new; end if;
  if new.approval_status = 'approved' then
    insert into public.user_roles (user_id, role, created_by) values (new.user_id, 'engineer', auth.uid())
      on conflict (user_id, role) do update set status = 'active';
    insert into public.notifications (user_id, event, title, detail, created_by)
      select new.user_id, 'engineer_approved', 'Engineer profile approved', 'You can now receive jobs', auth.uid()
      where tg_op = 'INSERT' or old.approval_status is distinct from 'approved';
  else
    update public.user_roles set status = 'inactive' where user_id = new.user_id and role = 'engineer';
  end if;
  return new;
end $$;
create trigger engineers_role_sync after insert or update of approval_status on public.engineers for each row execute function public.engineer_role_sync();

-- Assignment engine
create or replace function public.pick_engineer(_booking_id uuid) returns uuid language sql stable security definer set search_path = public as $$
  with b as (
    select coalesce(details->>'level','L1') as level, lower(coalesce(city,'')) as city, priority from public.bookings where id = _booking_id
  ), load as (
    select engineer_id, count(*) as active from public.bookings
    where engineer_id is not null and status in ('Open','In Progress') group by engineer_id
  )
  select e.id from public.engineers e, b
  left join lateral (select active from load where load.engineer_id = e.id) l on true
  where e.approval_status = 'approved' and e.available and e.status = 'active'
    and coalesce(l.active,0) < e.max_active_jobs
    and (b.level = 'L1' or e.grade = 'L2' or (b.level like '%L1%' and b.level <> 'L2'))
  order by
    (lower(e.city) = b.city) desc,          -- same city first
    (e.grade = case when b.level = 'L2' then 'L2' else e.grade end) desc,
    coalesce(l.active,0) asc,               -- least loaded
    e.rating desc,
    e.created_at asc
  limit 1
$$;

create or replace function public.assign_engineer(_booking_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare eid uuid; e public.engineers;
begin
  if auth.uid() is not null and not public.is_staff(auth.uid())
     and not exists (select 1 from public.bookings where id = _booking_id and customer_id = auth.uid()) then
    raise exception 'not allowed';
  end if;
  eid := public.pick_engineer(_booking_id);
  if eid is null then return null; end if;
  select * into e from public.engineers where id = eid;
  update public.bookings set engineer_id = e.id, engineer_name = e.full_name, engineer_phone = e.phone,
    progress = greatest(progress, 30)
  where id = _booking_id and engineer_id is null and status = 'Open';
  if found then
    insert into public.notifications (user_id, booking_id, event, title, detail, created_by)
      select e.user_id, _booking_id, 'job_assigned', 'New job assigned', ticket_no || ' · ' || title, auth.uid()
      from public.bookings where id = _booking_id and e.user_id is not null;
    return e.full_name;
  end if;
  return null;
end $$;
grant execute on function public.assign_engineer(uuid) to authenticated;
revoke execute on function public.pick_engineer(uuid) from public, anon;

create or replace function public.auto_assign_on_create() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assign_engineer(new.id);
  return new;
end $$;
create trigger bookings_auto_assign after insert on public.bookings for each row execute function public.auto_assign_on_create();

-- Engineer job actions
create or replace function public.engineer_job_action(_booking_id uuid, _action text) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_engineer_id();
begin
  if me is null then raise exception 'not an approved engineer'; end if;
  if _action = 'start' then
    update public.bookings set status = 'In Progress', progress = greatest(progress, 55), started_at = now()
      where id = _booking_id and engineer_id = me and status = 'Open';
  elsif _action = 'complete' then
    update public.bookings set status = 'Closed', progress = 100, completed_at = now()
      where id = _booking_id and engineer_id = me and status = 'In Progress';
  else raise exception 'unknown action';
  end if;
  if not found then raise exception 'job not in a valid state'; end if;
end $$;
grant execute on function public.engineer_job_action(uuid, text) to authenticated;

-- Customer rating
create or replace function public.rate_booking(_booking_id uuid, _rating int, _feedback text) returns void language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  if _rating < 1 or _rating > 5 then raise exception 'rating must be 1-5'; end if;
  update public.bookings set customer_rating = _rating, customer_feedback = left(_feedback, 2000)
    where id = _booking_id and customer_id = auth.uid() and status = 'Closed' and customer_rating is null
    returning engineer_id into eid;
  if not found then raise exception 'cannot rate this booking'; end if;
  if eid is not null then
    update public.engineers e set
      rating = (select round(avg(customer_rating)::numeric, 2) from public.bookings where engineer_id = eid and customer_rating is not null),
      ratings_count = (select count(*) from public.bookings where engineer_id = eid and customer_rating is not null)
    where e.id = eid;
  end if;
end $$;
grant execute on function public.rate_booking(uuid, int, text) to authenticated;

alter publication supabase_realtime add table public.engineers;