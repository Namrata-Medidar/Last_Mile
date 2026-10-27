CREATE UNIQUE INDEX bookings_customer_request_id_unique
ON public.bookings (customer_id, (details ->> 'clientRequestId'))
WHERE details ? 'clientRequestId';
