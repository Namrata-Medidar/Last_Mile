DROP POLICY IF EXISTS "Ticket delete permission" ON public.bookings;
DROP POLICY IF EXISTS "Ticket delete permission restrictive" ON public.bookings;
REVOKE DELETE ON public.bookings FROM authenticated;

DELETE FROM public.role_permissions
WHERE permission_id IN (
  SELECT id
  FROM public.permissions
  WHERE code = 'tickets.delete'
);

DELETE FROM public.permissions
WHERE code = 'tickets.delete';
