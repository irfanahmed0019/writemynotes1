-- Add banned column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;

-- Allow admins to update any profile (for banning)
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
