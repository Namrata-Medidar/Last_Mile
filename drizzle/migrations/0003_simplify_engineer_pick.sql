create or replace function public.pick_engineer(_booking_id uuid) returns uuid language sql stable security definer set search_path = public as $$
  with b as (
    select coalesce(details->>'level','L1') as level, lower(coalesce(city,'')) as city from public.bookings where id = _booking_id
  ), load as (
    select engineer_id, count(*) as active from public.bookings
    where engineer_id is not null and status in ('Open','In Progress') group by engineer_id
  )
  select e.id from public.engineers e cross join b
  left join load l on l.engineer_id = e.id
  where e.approval_status = 'approved' and e.available and e.status = 'active'
    and coalesce(l.active,0) < e.max_active_jobs
    and (position('L2' in b.level) = 0 or e.grade = 'L2')   -- L2 or L1+L2 jobs need an L2 lead
  order by
    (b.city <> '' and lower(e.city) = b.city) desc,          -- same city first
    (e.grade = 'L1' and position('L2' in b.level) = 0) desc, -- keep L2s free for L2 work
    coalesce(l.active,0) asc,                                 -- least loaded
    e.rating desc,
    e.created_at asc
  limit 1
$$;
revoke execute on function public.pick_engineer(uuid) from public, anon, authenticated;