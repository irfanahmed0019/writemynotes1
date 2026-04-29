
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: only admins can view roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS: no one can insert/update/delete via client
CREATE POLICY "No client modifications"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "No client updates"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "No client deletes"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (false);

-- Insert admin role for the user
INSERT INTO public.user_roles (user_id, role)
VALUES ('cebf37a3-d703-44e5-9992-b223e7b30c61', 'admin');

-- Admin policies: allow admin to read all messages
CREATE POLICY "Admins can view all messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin policies: allow admin to view all conversations
CREATE POLICY "Admins can view all conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin policies: allow admin to delete any request
CREATE POLICY "Admins can delete any request"
  ON public.requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
