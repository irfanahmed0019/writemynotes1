-- Allow users to read their own roles (fixes chicken-and-egg RLS issue)
CREATE POLICY "Users can read own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());