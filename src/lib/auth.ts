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
  role: 'student' | 'admin' | 'cashier' | 'programhead';
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
  try {
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    // If no session / RLS blocks the query, bail out silently
    if (roleError || !roleData) return null;

    const role = roleData.role as UserProfile['role'];

    if (role === 'admin') {
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) return null;

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
        avatarUrl: data.avatar_url ?? null,
        studentId: null,
        role: 'admin',
      };
    }

    if (role === 'cashier') {
      const { data, error } = await supabase
        .from('cashiers')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) return null;

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
        avatarUrl: data.avatar_url ?? null,
        studentId: null,
        role: 'cashier',
      };
    }

    if (role === 'programhead') {
      const { data, error } = await supabase
        .from('programheads')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) return null;

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
        avatarUrl: data.avatar_url ?? null,
        studentId: null,
        role: 'programhead',
      };
    }

    // student
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

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
      avatarUrl: data.avatar_url ?? null,
      studentId: (data as any).student_id || null,
      role: 'student',
    };

  } catch (err) {
    // Network error or session expired — fail silently
    console.warn('fetchUserProfile failed:', err);
    return null;
  }
}

// Get redirect path based on role
export function getRedirectPath(role: UserProfile['role']): string {
  switch (role) {
    case 'admin':       return '/admin/dashboard';
    case 'cashier':     return '/admin/payments';
    case 'programhead': return '/admin/students';
    case 'student':     return '/student/dashboard';
    default:            return '/';
  }
}