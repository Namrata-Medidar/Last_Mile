UPDATE public.bookings
SET total = GREATEST(0, ROUND((details ->> 'totalPayable')::numeric))
WHERE jsonb_typeof(details -> 'totalPayable') = 'number';
