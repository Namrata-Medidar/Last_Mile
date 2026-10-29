grant select, insert on public.booking_attachments to authenticated;
alter table public.booking_attachments enable row level security;

do $$
declare existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_attachments'
  loop
    execute format(
      'drop policy %I on public.booking_attachments',
      existing_policy.policyname
    );
  end loop;
end
$$;

create policy "Read attachments for visible bookings"
  on public.booking_attachments for select to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = booking_id
        and (
          b.customer_id = auth.uid()
          or b.engineer_id = public.my_engineer_id()
          or public.is_staff(auth.uid())
        )
    )
  );

create policy "Add attachments to visible bookings"
  on public.booking_attachments for insert to authenticated
  with check (
    exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'booking-attachments'
        and o.name = storage_path
        and split_part(o.name, '/', 1) = booking_id::text
        and o.owner_id = auth.uid()::text
    )
  );

notify pgrst, 'reload schema';
