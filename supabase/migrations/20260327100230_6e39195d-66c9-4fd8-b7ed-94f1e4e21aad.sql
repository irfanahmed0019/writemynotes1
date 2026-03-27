
-- Study config: stores semester label and timetable
CREATE TABLE public.study_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_label text NOT NULL DEFAULT 'S1',
  timetable_url text DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.study_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view study config" ON public.study_config FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert study config" ON public.study_config FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update study config" ON public.study_config FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete study config" ON public.study_config FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Study subjects: each subject with notes/papers links
CREATE TABLE public.study_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid REFERENCES public.study_config(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  notes_url text DEFAULT '',
  papers_url text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.study_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view study subjects" ON public.study_subjects FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert study subjects" ON public.study_subjects FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update study subjects" ON public.study_subjects FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete study subjects" ON public.study_subjects FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default S1 config
INSERT INTO public.study_config (semester_label, timetable_url) VALUES ('S1', '');
