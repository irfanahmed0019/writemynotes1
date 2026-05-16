
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

DROP POLICY IF EXISTS "Authenticated can read presence" ON public.user_presence;
CREATE POLICY "Authenticated can read presence"
ON public.user_presence FOR SELECT
TO authenticated
USING (true);
