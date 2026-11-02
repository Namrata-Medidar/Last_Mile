ALTER TABLE public.customer_details
ADD COLUMN IF NOT EXISTS company TEXT;

UPDATE public.customer_details
SET company = btrim(company)
WHERE company IS DISTINCT FROM btrim(company);

REVOKE ALL ON TABLE public.customer_details FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.customer_details TO authenticated;

ALTER TABLE public.customer_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer details company read" ON public.customer_details;
DROP POLICY IF EXISTS "Customer details company insert" ON public.customer_details;
DROP POLICY IF EXISTS "Customer details company boundary" ON public.customer_details;

CREATE POLICY "Customer details company read"
ON public.customer_details
FOR SELECT
TO authenticated
USING (
  company = (
    SELECT NULLIF(btrim(profiles.company), '')
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
);

CREATE POLICY "Customer details company insert"
ON public.customer_details
FOR INSERT
TO authenticated
WITH CHECK (
  company = (
    SELECT NULLIF(btrim(profiles.company), '')
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
);

CREATE POLICY "Customer details company boundary"
ON public.customer_details
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  company = (
    SELECT NULLIF(btrim(profiles.company), '')
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
)
WITH CHECK (
  company = (
    SELECT NULLIF(btrim(profiles.company), '')
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.set_customer_details_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  authenticated_company TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    IF NEW.company IS NULL OR btrim(NEW.company) = '' THEN
      RAISE EXCEPTION 'A company is required when creating customer details';
    END IF;
    RETURN NEW;
  END IF;

  SELECT profiles.company
  INTO authenticated_company
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  IF authenticated_company IS NULL OR btrim(authenticated_company) = '' THEN
    RAISE EXCEPTION 'The authenticated user must have a company in their profile';
  END IF;

  NEW.company := btrim(authenticated_company);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_details_set_company ON public.customer_details;
CREATE TRIGGER customer_details_set_company
BEFORE INSERT ON public.customer_details
FOR EACH ROW
EXECUTE FUNCTION public.set_customer_details_company();

REVOKE ALL ON FUNCTION public.set_customer_details_company() FROM PUBLIC, anon, authenticated;
