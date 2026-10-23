create or replace function public.set_my_availability(_available boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.engineers set available = _available where user_id = auth.uid() and approval_status = 'approved';
  if not found then raise exception 'not an approved engineer'; end if;
end $$;
grant execute on function public.set_my_availability(boolean) to authenticated;