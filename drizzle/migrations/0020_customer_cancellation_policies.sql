CREATE TABLE IF NOT EXISTS public.customer_cancellation_policies (
  customer_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  fee numeric(12, 2) NOT NULL CHECK (fee >= 0),
  free_hours numeric(6, 2) NOT NULL CHECK (free_hours >= 0),
  anchor text NOT NULL CHECK (anchor IN ('after_booking', 'before_visit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT ON public.customer_cancellation_policies TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.customer_cancellation_policies TO authenticated;
GRANT ALL ON public.customer_cancellation_policies TO service_role;
ALTER TABLE public.customer_cancellation_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers read own cancellation policy" ON public.customer_cancellation_policies;
CREATE POLICY "Customers read own cancellation policy"
ON public.customer_cancellation_policies
FOR SELECT
TO authenticated
USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Super admins read cancellation policies" ON public.customer_cancellation_policies;
CREATE POLICY "Super admins read cancellation policies"
ON public.customer_cancellation_policies
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins manage cancellation policies" ON public.customer_cancellation_policies;
CREATE POLICY "Super admins manage cancellation policies"
ON public.customer_cancellation_policies
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS customer_cancellation_policies_updated ON public.customer_cancellation_policies;
CREATE TRIGGER customer_cancellation_policies_updated
BEFORE UPDATE ON public.customer_cancellation_policies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS audit_customer_cancellation_policies ON public.customer_cancellation_policies;
CREATE TRIGGER audit_customer_cancellation_policies
AFTER INSERT OR UPDATE OR DELETE ON public.customer_cancellation_policies
FOR EACH ROW EXECUTE FUNCTION public.audit_row();
