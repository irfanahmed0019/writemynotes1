
-- ============ app_settings ============
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app_settings" ON public.app_settings
  FOR SELECT USING (true);
CREATE POLICY "Admins can insert app_settings" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update app_settings" ON public.app_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete app_settings" ON public.app_settings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_app_settings_updated
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.app_settings (key, value) VALUES
  ('damu_daily_limit', '{"limit": 30}'::jsonb),
  ('hero', '{"title": "WriteMyNotes", "subtitle": "Get your records done. Or make money writing them.", "enabled": true}'::jsonb),
  ('announcement', '{"text": "", "enabled": false}'::jsonb),
  ('faq', '{"enabled": true, "items": [
     {"q": "What is WriteMyNotes?", "a": "WriteMyNotes is a platform for users who want to complete their records written by others. Users can post their writing requests, and writers can fulfill them and earn money."},
     {"q": "How do writers earn money?", "a": "Writers complete note requests posted by users and get paid for each accepted submission."},
     {"q": "Can I upload my own notes?", "a": "Yes! You can upload notes as PDF, plain text, or HTML, or write directly on the platform."}
  ]}'::jsonb),
  ('feature_toggles', '{"faq": true, "notes_upload": true, "landing_faq": true, "announcement": false, "chatbot": true}'::jsonb),
  ('featured_notes', '{"ids": []}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============ damu_usage ============
CREATE TABLE public.damu_usage (
  user_id UUID NOT NULL,
  day DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.damu_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own damu usage" ON public.damu_usage
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own damu usage" ON public.damu_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own damu usage" ON public.damu_usage
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins read all damu usage" ON public.damu_usage
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ user_notes ============
CREATE TABLE public.user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text', -- text | html | markdown | pdf
  content TEXT,
  file_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public notes" ON public.user_notes
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON public.user_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.user_notes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.user_notes
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any user note" ON public.user_notes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_user_notes_updated
  BEFORE UPDATE ON public.user_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_user_notes_user ON public.user_notes(user_id);
CREATE INDEX idx_user_notes_public ON public.user_notes(is_public, created_at DESC);

-- ============ user_presence ============
CREATE TABLE public.user_presence (
  user_id UUID PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own presence" ON public.user_presence
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own presence" ON public.user_presence
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users read own presence" ON public.user_presence
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins read all presence" ON public.user_presence
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_user_presence_last_seen ON public.user_presence(last_seen DESC);

-- ============ Storage bucket: notes ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('notes', 'notes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Notes files publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'notes');
CREATE POLICY "Authenticated users can upload notes files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'notes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own notes files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'notes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own notes files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'notes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============ Add ui_layout entries for new features ============
INSERT INTO public.ui_layout (key, label, icon, visible, position, sort_order) VALUES
  ('mynotes', 'My Notes', 'NotebookPen', true, 'header', 5)
ON CONFLICT DO NOTHING;
