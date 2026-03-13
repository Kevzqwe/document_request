// Profile storage utilities using Supabase Storage for avatars
import { supabase } from '@/integrations/supabase/client';

export interface StoredProfile {
  id: string;
  userId: string;
  avatarUrl: string | null;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  contactNumber?: string;
  updatedAt: string;
}

const PROFILES_KEY = 'user_profiles';

// Get all profiles from localStorage (for non-avatar profile cache)
export const getAllProfiles = (): StoredProfile[] => {
  try {
    const stored = localStorage.getItem(PROFILES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Get profile by user ID
export const getProfileByUserId = (userId: string): StoredProfile | undefined => {
  const profiles = getAllProfiles();
  return profiles.find(p => p.userId === userId);
};

// Save or update profile cache in localStorage
export const saveProfile = (profile: Omit<StoredProfile, 'id' | 'updatedAt'>): StoredProfile => {
  const profiles = getAllProfiles();
  const existingIndex = profiles.findIndex(p => p.userId === profile.userId);
  
  const savedProfile: StoredProfile = {
    ...profile,
    id: existingIndex >= 0 ? profiles[existingIndex].id : `profile-${Date.now()}`,
    updatedAt: new Date().toISOString(),
  };
  
  if (existingIndex >= 0) {
    profiles[existingIndex] = savedProfile;
  } else {
    profiles.push(savedProfile);
  }
  
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  return savedProfile;
};

// Upload avatar to Supabase Storage and return public URL
export const uploadAvatar = async (
  userId: string,
  file: File
): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/avatar.${fileExt}`;

  // Upload (upsert) the file to the avatars bucket
  const { error } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true });

  if (error) {
    console.error('Avatar upload error:', error);
    throw error;
  }

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  // Append cache-buster to avoid browser caching old avatar
  return `${urlData.publicUrl}?t=${Date.now()}`;
};

// Get avatar display URL with fallback
export const getAvatarUrl = (avatarUrl: string | null | undefined, fallbackSeed?: string): string => {
  if (!avatarUrl) {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${fallbackSeed || 'default'}`;
  }

  // Legacy local:// references fall back to dicebear
  if (avatarUrl.startsWith('local://')) {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${fallbackSeed || 'default'}`;
  }

  return avatarUrl;
};

// Delete avatar from storage
export const deleteAvatar = async (userId: string): Promise<void> => {
  const { data: files } = await supabase.storage
    .from('avatars')
    .list(userId);

  if (files && files.length > 0) {
    const filePaths = files.map(f => `${userId}/${f.name}`);
    await supabase.storage.from('avatars').remove(filePaths);
  }
};

export const profileStorage = {
  getAll: getAllProfiles,
  getByUserId: getProfileByUserId,
  save: saveProfile,
  uploadAvatar,
  getAvatarUrl,
  deleteAvatar,
};
