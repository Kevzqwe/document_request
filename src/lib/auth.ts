// Authentication utilities for Supabase Auth
import { supabase } from '@/integrations/supabase/client';

export interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  contactNumber: string | null;
  gradeLevel: string | null;
  section: string | null;
  avatarUrl: string | null;
  studentId: string | null;
  role: 'student' | 'admin';
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSession {
  user: AuthUser;
  profile: UserProfile;
}

// Fetch user profile from the database based on role
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  // Check role first
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (!roleData) return null;

  const role = roleData.role as 'student' | 'admin';

  if (role === 'admin') {
    const { data } = await supabase
      .from('admins')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      username: data.username,
      firstName: data.first_name,
      lastName: data.last_name,
      middleName: data.middle_name,
      contactNumber: data.contact_number,
      gradeLevel: null,
      section: null,
      avatarUrl: data.avatar_url,
      studentId: null,
      role: 'admin',
    };
  } else {
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      username: data.username,
      firstName: data.first_name,
      lastName: data.last_name,
      middleName: data.middle_name,
      contactNumber: data.contact_number,
      gradeLevel: data.grade_level,
      section: data.section,
      avatarUrl: data.avatar_url,
      studentId: (data as any).student_id || null,
      role: 'student',
    };
  }
}

// Get redirect path based on role
export function getRedirectPath(role: 'student' | 'admin'): string {
  return role === 'admin' ? '/admin/dashboard' : '/student/dashboard';
}
