-- Add soft delete functionality for tickets/bookings

-- 1. Add deleted_at column to bookings table
alter table public.bookings add column deleted_at timestamptz;

-- 2. Create permission for soft delete ticket action
insert into public.permissions (code, module, description)
values ('ticket.soft_delete', 'ticket', 'Soft delete ticket (user can delete their own ticket)')
on conflict (code) do nothing;

-- 3. Create RPC function to soft delete a ticket
create or replace function public.soft_delete_booking(_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _booking_customer_id uuid;
  _current_user_id uuid;
begin
  _current_user_id := auth.uid();
  if _current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select customer_id into _booking_customer_id
  from public.bookings
  where id = _booking_id;

  if _booking_customer_id is null then
    raise exception 'Booking not found';
  end if;

  -- Only the customer who created the ticket or staff can soft delete
  if _booking_customer_id != _current_user_id and not public.is_staff(_current_user_id) then
    raise exception 'Only the ticket creator or staff can soft delete this ticket';
  end if;

  -- Update deleted_at timestamp to mark as soft deleted
  update public.bookings
  set deleted_at = now(), updated_at = now(), updated_by = _current_user_id
  where id = _booking_id;
end $$;

-- 4. Update RLS policy for bookings to exclude soft deleted tickets for customers
-- First, drop existing select policy
drop policy if exists "Customers read own bookings" on public.bookings;

-- Create new select policy that excludes deleted tickets
create policy "Customers read own bookings" on public.bookings for select to authenticated
using (
  (customer_id = auth.uid() or public.is_staff(auth.uid()))
  and (deleted_at is null or public.is_staff(auth.uid()))
);

-- 5. Grant execute permission on the new function
grant execute on function public.soft_delete_booking(uuid) to authenticated;
