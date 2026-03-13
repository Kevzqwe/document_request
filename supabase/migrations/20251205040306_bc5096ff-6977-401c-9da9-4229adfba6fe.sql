-- Add INSERT policy for students table
CREATE POLICY "Users can insert own student profile"
ON public.students
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add INSERT policy for admins table  
CREATE POLICY "Users can insert own admin profile"
ON public.admins
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add INSERT policy for user_roles table
CREATE POLICY "System can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- Get role from user metadata, default to 'student'
  user_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'student');
  
  -- Insert into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role::app_role);
  
  -- Insert into appropriate profile table based on role
  IF user_role = 'admin' THEN
    INSERT INTO public.admins (user_id, username, first_name, last_name, middle_name, contact_number)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'username', NEW.email),
      COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
      NEW.raw_user_meta_data ->> 'middle_name',
      NEW.raw_user_meta_data ->> 'contact_number'
    );
  ELSE
    INSERT INTO public.students (user_id, username, first_name, last_name, middle_name, contact_number, grade_level, section)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'username', NEW.email),
      COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
      NEW.raw_user_meta_data ->> 'middle_name',
      NEW.raw_user_meta_data ->> 'contact_number',
      NEW.raw_user_meta_data ->> 'grade_level',
      NEW.raw_user_meta_data ->> 'section'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();