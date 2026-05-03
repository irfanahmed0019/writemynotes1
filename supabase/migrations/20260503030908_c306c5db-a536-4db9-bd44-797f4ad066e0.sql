ALTER TABLE public.conversations
  ALTER COLUMN request_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_participants
  ON public.conversations (seller_id, buyer_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversations'
      AND policyname = 'Admins can create conversations'
  ) THEN
    CREATE POLICY "Admins can create conversations"
    ON public.conversations
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;