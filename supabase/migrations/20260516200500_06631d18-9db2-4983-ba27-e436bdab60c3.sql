
-- Attachments on messages
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_type text;

-- Storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Chat attachments are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own chat attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Move chat tab to bottom nav
UPDATE public.ui_layout 
SET position = 'bottom', icon = 'MessageCircle', sort_order = 2, visible = true
WHERE key = 'chat';

-- Re-order bottom items to make room
UPDATE public.ui_layout SET sort_order = 0 WHERE key = 'home';
UPDATE public.ui_layout SET sort_order = 1 WHERE key = 'study';
UPDATE public.ui_layout SET sort_order = 3 WHERE key = 'profile';
UPDATE public.ui_layout SET sort_order = 4 WHERE key = 'admin';
