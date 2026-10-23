CREATE SEQUENCE IF NOT EXISTS public.invoice_seq;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS invoice_no text;

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  kind text NOT NULL DEFAULT 'payment',
  amount numeric NOT NULL,
  method text NOT NULL,
  reference text,
  note text,
  status text NOT NULL DEFAULT 'recorded',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read payments of visible bookings" ON public.payments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = payments.booking_id AND (b.customer_id = auth.uid() OR public.is_staff(auth.uid()))));

CREATE OR REPLACE FUNCTION public.record_payment(_booking_id uuid, _kind text, _amount numeric, _method text, _reference text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings; paid numeric;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _kind NOT IN ('payment','refund') THEN RAISE EXCEPTION 'Invalid kind'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF _kind = 'refund' AND _amount > b.amount_paid THEN RAISE EXCEPTION 'Refund exceeds amount paid'; END IF;
  INSERT INTO public.payments(booking_id, kind, amount, method, reference, note) VALUES (_booking_id, _kind, _amount, _method, _reference, left(_note, 500));
  paid := b.amount_paid + CASE WHEN _kind = 'payment' THEN _amount ELSE -_amount END;
  UPDATE public.bookings SET amount_paid = paid,
    payment_status = CASE WHEN _kind = 'refund' AND paid <= 0 THEN 'refunded'
                          WHEN _kind = 'refund' THEN 'partially_refunded'
                          WHEN paid >= coalesce(b.total, 0) THEN 'paid'
                          ELSE 'partially_paid' END,
    invoice_no = coalesce(b.invoice_no, 'INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 5, '0'))
  WHERE id = _booking_id;
  INSERT INTO public.notifications(user_id, booking_id, event, title, detail)
  VALUES (b.customer_id, _booking_id, _kind || '_recorded',
    CASE WHEN _kind = 'payment' THEN 'Payment received' ELSE 'Refund issued' END,
    b.ticket_no || ' · ₹' || round(_amount)::text);
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, new_data)
  VALUES (auth.uid(), 'record_' || _kind, 'bookings', _booking_id::text, jsonb_build_object('amount', _amount, 'method', _method, 'reference', _reference));
END $$;
REVOKE ALL ON FUNCTION public.record_payment(uuid, text, numeric, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid, text, numeric, text, text, text) TO authenticated;