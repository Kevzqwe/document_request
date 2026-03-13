-- Rename profiles table to students
ALTER TABLE public.profiles RENAME TO students;

-- Create admins table
CREATE TABLE public.admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  middle_name text,
  username text NOT NULL,
  contact_number text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on admins table
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- RLS policies for admins table
CREATE POLICY "Admins can view all admins"
ON public.admins FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update own profile"
ON public.admins FOR UPDATE
USING (auth.uid() = user_id);

-- Update RLS policies on students table (formerly profiles)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.students;
DROP POLICY IF EXISTS "Users can update own profile" ON public.students;

CREATE POLICY "Users can view all students"
ON public.students FOR SELECT
USING (true);

CREATE POLICY "Users can update own student profile"
ON public.students FOR UPDATE
USING (auth.uid() = user_id);

-- Add trigger for admins updated_at
CREATE TRIGGER update_admins_updated_at
BEFORE UPDATE ON public.admins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();