
CREATE TABLE public.ui_layout (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'circle',
  visible BOOLEAN NOT NULL DEFAULT true,
  position TEXT NOT NULL DEFAULT 'bottom' CHECK (position IN ('bottom', 'header')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ui_layout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ui_layout" ON public.ui_layout FOR SELECT USING (true);
CREATE POLICY "Admins can update ui_layout" ON public.ui_layout FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert ui_layout" ON public.ui_layout FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete ui_layout" ON public.ui_layout FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default layout items
INSERT INTO public.ui_layout (key, label, icon, visible, position, sort_order) VALUES
  ('home', 'Home', 'Home', true, 'bottom', 0),
  ('chat', 'Chat', 'MessageCircle', true, 'bottom', 1),
  ('study', 'Study', 'BookOpen', true, 'bottom', 2),
  ('profile', 'Profile', 'User', true, 'bottom', 3),
  ('admin', 'Admin', 'Shield', true, 'bottom', 4),
  ('post', 'Post', 'Plus', true, 'header', 0),
  ('activity', 'Activity', 'Sparkles', true, 'header', 1),
  ('install', 'Install', 'Download', true, 'header', 2);
