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
  role: 'student' | 'alumni' | 'admin' | 'cashier' | 'programhead';
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSession {
  user: AuthUser;
  profile: UserProfile;
}

// Fetch user profile — queries all 5 role tables in parallel.
// No longer touches user_roles table (was causing 406 errors).
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const [adminRes, cashierRes, programheadRes, studentRes, alumniRes] = await Promise.all([
    supabase.from('admins').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('cashiers').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('programheads').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('students').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('alumni').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  if (adminRes.data) {
    const d = adminRes.data;
    return {
      id:            d.id,
      user_id:       d.user_id,
      username:      d.username,
      firstName:     d.first_name,
      lastName:      d.last_name,
      middleName:    d.middle_name,
      contactNumber: d.contact_number,
      gradeLevel:    null,
      section:       null,
      avatarUrl:     d.avatar_url ?? null,
      studentId:     null,
      role:          'admin',
    };
  }

  if (cashierRes.data) {
    const d = cashierRes.data;
    return {
      id:            d.id,
      user_id:       d.user_id,
      username:      d.username,
      firstName:     d.first_name,
      lastName:      d.last_name,
      middleName:    d.middle_name,
      contactNumber: d.contact_number,
      gradeLevel:    null,
      section:       null,
      avatarUrl:     d.avatar_url ?? null,
      studentId:     null,
      role:          'cashier',
    };
  }

  if (programheadRes.data) {
    const d = programheadRes.data;
    return {
      id:            d.id,
      user_id:       d.user_id,
      username:      d.username,
      firstName:     d.first_name,
      lastName:      d.last_name,
      middleName:    d.middle_name,
      contactNumber: d.contact_number,
      gradeLevel:    null,
      section:       null,
      avatarUrl:     d.avatar_url ?? null,
      studentId:     null,
      role:          'programhead',
    };
  }

  if (studentRes.data) {
    const d = studentRes.data;
    return {
      id:            d.id,
      user_id:       d.user_id,
      username:      d.username,
      firstName:     d.first_name,
      lastName:      d.last_name,
      middleName:    d.middle_name,
      contactNumber: d.contact_number,
      gradeLevel:    d.grade_level,
      section:       d.section,
      avatarUrl:     d.avatar_url ?? null,
      studentId:     (d as any).student_id || null,
      role:          'student',
    };
  }

  if (alumniRes.data) {
    const d = alumniRes.data;
    return {
      id:            d.id,
      user_id:       d.user_id,
      username:      d.username,
      firstName:     d.first_name,
      lastName:      d.last_name,
      middleName:    d.middle_name ?? null,
      contactNumber: d.contact_number,
      gradeLevel:    null,
      section:       null,
      avatarUrl:     d.avatar_url ?? null,
      studentId:     (d as any).student_id || null,
      role:          'alumni',
    };
  }

  return null;
}

// Get redirect path based on role
export function getRedirectPath(role: UserProfile['role']): string {
  switch (role) {
    case 'admin':       return '/admin/dashboard';
    case 'cashier':     return '/admin/payments';
    case 'programhead': return '/admin/students';
    case 'student':     return '/student/dashboard';
    case 'alumni':      return '/student/dashboard';
    default:            return '/';
  }
}