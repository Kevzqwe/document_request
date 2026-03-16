import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserProfile, getRedirectPath, type UserProfile, type AuthUser } from '@/lib/auth';

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const initialized = useRef(false); // ✅ guard against double fetch on mount

  // ✅ Helper: clear all auth state and redirect to login
  const clearAuthState = async (redirect = true) => {
    setUser(null);
    setProfile(null);
    setIsLoading(false);
    if (redirect) navigate('/');
  };

  // ✅ Helper: set user + fetch profile from a session user object
  const hydrateUserFromSession = async (sessionUser: { id: string; email?: string | null }) => {
    const authUser: AuthUser = {
      id: sessionUser.id,
      email: sessionUser.email || '',
    };
    setUser(authUser);

    const userProfile = await fetchUserProfile(sessionUser.id);
    setProfile(userProfile);
    setIsLoading(false);

    return userProfile;
  };

  useEffect(() => {
    // ✅ Step 1: Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip duplicate handling before getSession() initializes
        if (!initialized.current) return;

        // ✅ Handle token expiry / sign out events
        if (
          event === 'SIGNED_OUT' ||
          (event === 'TOKEN_REFRESHED' && !session)
        ) {
          await clearAuthState();
          return;
        }

        // ✅ Handle password recovery or user updates
        if (event === 'PASSWORD_RECOVERY') {
          return;
        }

        if (session?.user) {
          // Use setTimeout to avoid Supabase internal deadlock
          setTimeout(async () => {
            await hydrateUserFromSession(session.user);
          }, 0);
        } else {
          await clearAuthState();
        }
      }
    );

    // ✅ Step 2: Check existing session on mount
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session retrieval error:', error.message);
          // ✅ Clear any stale/corrupted tokens
          await supabase.auth.signOut();
          await clearAuthState();
          return;
        }

        if (session?.user) {
          await hydrateUserFromSession(session.user);
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Unexpected error during session init:', err);
        await supabase.auth.signOut();
        await clearAuthState();
      } finally {
        initialized.current = true; // ✅ Allow onAuthStateChange to process future events
      }
    };

    initSession();

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        const userProfile = await hydrateUserFromSession(data.user);

        if (userProfile) {
          const redirectPath = getRedirectPath(userProfile.role);
          navigate(redirectPath);
        }
      }

      return { error: null };
    } catch (err) {
      console.error('Login error:', err);
      return { error: 'An unexpected error occurred. Please try again.' };
    }
  };

  const refreshProfile = async () => {
    if (!user) return;

    try {
      const userProfile = await fetchUserProfile(user.id);
      setProfile(userProfile);
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // ✅ Always clear state even if signOut fails
      setUser(null);
      setProfile(null);
      navigate('/');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        login,
        logout,
        refreshProfile,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};