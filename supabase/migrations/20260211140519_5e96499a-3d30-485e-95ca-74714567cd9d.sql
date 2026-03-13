
-- Fix: Restrict students table SELECT to own profile or admin access
DROP POLICY IF EXISTS "Users can view all students" ON public.students;

CREATE POLICY "Students can view own profile"
ON public.students
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all students"
ON public.students
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
