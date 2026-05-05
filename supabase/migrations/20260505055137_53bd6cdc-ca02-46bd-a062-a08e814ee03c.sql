
-- Add subject + description to user_notes
ALTER TABLE public.user_notes
  ADD COLUMN IF NOT EXISTS subject text DEFAULT '',
  ADD COLUMN IF NOT EXISTS description text DEFAULT '';

-- Allow image content type (no enum, content_type is text — just rely on convention)

-- Note upvotes
CREATE TABLE IF NOT EXISTS public.note_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.user_notes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, user_id)
);

ALTER TABLE public.note_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view note votes"
  ON public.note_votes FOR SELECT USING (true);

CREATE POLICY "Users can upvote"
  ON public.note_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own vote"
  ON public.note_votes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_note_votes_note ON public.note_votes(note_id);
CREATE INDEX IF NOT EXISTS idx_note_votes_user ON public.note_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_subject ON public.user_notes(subject);
