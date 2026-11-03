GRANT SELECT ON TABLE public.services TO anon, authenticated;

DROP POLICY IF EXISTS "Public read active" ON public.services;
DROP POLICY IF EXISTS "Public read active services" ON public.services;
DROP POLICY IF EXISTS "Authenticated service catalog read" ON public.services;

CREATE POLICY "Public read active services" ON public.services
  FOR SELECT
  TO anon
  USING (status = 'active');

CREATE POLICY "Authenticated service catalog read" ON public.services
  FOR SELECT
  TO authenticated
  USING (status = 'active' OR public.is_staff(auth.uid()));
