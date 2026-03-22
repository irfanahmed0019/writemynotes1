
-- Add bio and pages columns to profiles and requests
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text DEFAULT '';
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS pages integer DEFAULT 1;

-- Writing samples table for handwriting photos
CREATE TABLE public.writing_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.writing_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view writing samples" ON public.writing_samples FOR SELECT USING (true);
CREATE POLICY "Users can insert own samples" ON public.writing_samples FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own samples" ON public.writing_samples FOR DELETE USING (auth.uid() = user_id);

-- Post interests table (writer expresses interest, poster approves)
CREATE TABLE public.post_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  writer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id, writer_id)
);
ALTER TABLE public.post_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view interests" ON public.post_interests FOR SELECT USING (true);
CREATE POLICY "Writers can create interest" ON public.post_interests FOR INSERT WITH CHECK (auth.uid() = writer_id);
CREATE POLICY "Poster can update interest status" ON public.post_interests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND r.user_id = auth.uid())
);
CREATE POLICY "Writers can delete own interest" ON public.post_interests FOR DELETE USING (auth.uid() = writer_id);

-- Allow users to update messages (for read_at)
CREATE POLICY "Users can update read_at in their conversations" ON public.messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid()))
);

-- Storage bucket for writing samples
INSERT INTO storage.buckets (id, name, public) VALUES ('writing-samples', 'writing-samples', true);

CREATE POLICY "Anyone can view writing samples" ON storage.objects FOR SELECT USING (bucket_id = 'writing-samples');
CREATE POLICY "Authenticated users can upload writing samples" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'writing-samples' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete own writing samples" ON storage.objects FOR DELETE USING (bucket_id = 'writing-samples' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime for post_interests
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_interests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.writing_samples;
