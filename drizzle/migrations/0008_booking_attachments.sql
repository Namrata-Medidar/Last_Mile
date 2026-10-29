create table if not exists public.booking_attachments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  file_size bigint,
  content_type text,
  uploaded_at timestamptz not null default now()
);

alter table public.booking_attachments
  add column if not exists file_size bigint,
  add column if not exists content_type text,
  add column if not exists uploaded_at timestamptz not null default now();

create index if not exists idx_booking_attachments_booking_id
  on public.booking_attachments (booking_id);
create unique index if not exists idx_booking_attachments_storage_path
  on public.booking_attachments (storage_path);

grant select, insert on public.booking_attachments to authenticated;
grant all on public.booking_attachments to service_role;
alter table public.booking_attachments enable row level security;

drop policy if exists "Read attachments for visible bookings" on public.booking_attachments;
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

drop policy if exists "Add attachments to visible bookings" on public.booking_attachments;
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

insert into storage.buckets (id, name, public)
values ('booking-attachments', 'booking-attachments', false)
on conflict (id) do update set public = false;

drop policy if exists "Read files for visible bookings" on storage.objects;
create policy "Read files for visible bookings"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'booking-attachments'
    and exists (
      select 1
      from public.bookings b
      where b.id::text = split_part(name, '/', 1)
        and (
          b.customer_id = auth.uid()
          or b.engineer_id = public.my_engineer_id()
          or public.is_staff(auth.uid())
        )
    )
  );

drop policy if exists "Upload files to visible bookings" on storage.objects;
create policy "Upload files to visible bookings"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'booking-attachments'
    and exists (
      select 1
      from public.bookings b
      where b.id::text = split_part(name, '/', 1)
        and (
          b.customer_id = auth.uid()
          or b.engineer_id = public.my_engineer_id()
          or public.is_staff(auth.uid())
        )
    )
  );

drop policy if exists "Remove own uploaded files" on storage.objects;
create policy "Remove own uploaded files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'booking-attachments'
    and owner_id = auth.uid()::text
    and exists (
      select 1
      from public.bookings b
      where b.id::text = split_part(name, '/', 1)
        and (
          b.customer_id = auth.uid()
          or b.engineer_id = public.my_engineer_id()
          or public.is_staff(auth.uid())
        )
    )
  );

notify pgrst, 'reload schema';
