
-- Add notes_content column to study_subjects for admin-written rich text notes
ALTER TABLE public.study_subjects ADD COLUMN IF NOT EXISTS notes_content text DEFAULT '';
