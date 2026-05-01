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
  setIgnoreNextSignOut: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]           = useState<AuthUser | null>(null);
  const [profile, setProfile]     = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const initialized       = useRef(false);
  const ignoreNextSignOut = useRef(false);

  const setIgnoreNextSignOut = (value: boolean) => {
    ignoreNextSignOut.current = value;
  };

  const clearAuthState = (redirect = true) => {
    setUser(null);
    setProfile(null);
    setIsLoading(false);
    if (redirect) navigate('/');
  };

  const hydrateUserFromSession = async (sessionUser: { id: string; email?: string | null }) => {
    const authUser: AuthUser = { id: sessionUser.id, email: sessionUser.email || '' };
    setUser(authUser);
    const userProfile = await fetchUserProfile(sessionUser.id);
    setProfile(userProfile);
    setIsLoading(false);
    return userProfile;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!initialized.current) return;

        if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
          // Pre-OTP intentional sign-out from Login.tsx — skip redirect
          if (ignoreNextSignOut.current) {
            ignoreNextSignOut.current = false;
            return;
          }
          clearAuthState();
          return;
        }

        if (event === 'PASSWORD_RECOVERY') return;

        if (session?.user) {
          setTimeout(async () => {
            await hydrateUserFromSession(session.user);
          }, 0);
        } else {
          clearAuthState();
        }
      }
    );

    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('Stale session, clearing:', error.message);
          ignoreNextSignOut.current = true;
          await supabase.auth.signOut();
          ignoreNextSignOut.current = false;
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          await hydrateUserFromSession(session.user);
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Session init error:', err);
        ignoreNextSignOut.current = true;
        await supabase.auth.signOut();
        ignoreNextSignOut.current = false;
        setIsLoading(false);
      } finally {
        initialized.current = true;
      }
    };

    initSession();

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };

      if (data.user) {
        const userProfile = await hydrateUserFromSession(data.user);
        if (userProfile) navigate(getRedirectPath(userProfile.role));
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
      setUser(null);
      setProfile(null);
      navigate('/');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      login,
      logout,
      refreshProfile,
      isAuthenticated: !!user,
      isLoading,
      setIgnoreNextSignOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};