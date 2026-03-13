
-- =====================================================
-- SECURITY FIX 1: Prevent privilege escalation on user_roles
-- Users should NOT be able to insert their own roles.
-- Only the handle_new_user trigger (SECURITY DEFINER) should do this.
-- =====================================================
DROP POLICY IF EXISTS "System can insert user roles" ON public.user_roles;

-- =====================================================
-- SECURITY FIX 2: Prevent anyone from self-registering as admin
-- Only the handle_new_user trigger (SECURITY DEFINER) should create admin profiles.
-- =====================================================
DROP POLICY IF EXISTS "Users can insert own admin profile" ON public.admins;

-- =====================================================
-- SECURITY FIX 3: Fix mutable search_path on update_updated_at_column
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- =====================================================
-- SECURITY FIX 4: Restrict announcements to authenticated users only
-- =====================================================
DROP POLICY IF EXISTS "Everyone can view announcements" ON public.announcements;
CREATE POLICY "Authenticated users can view announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (true);
