import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserProfile, getRedirectPath, type UserProfile, type AuthUser } from '@/lib/auth';

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  login: (email: string, password: string) => Promise<{ error: string | null; profile: UserProfile | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
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
  const navigate                  = useNavigate();
  const initialized               = useRef(false);
  const loginInProgress           = useRef(false);

  const clearAuthState = (redirect = true) => {
    setUser(null);
    setProfile(null);
    setIsLoading(false);
    if (redirect) navigate('/', { replace: true });
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

        if (event === 'SIGNED_OUT') {
          if ((window as any).__otpFlowSignOut) {
            (window as any).__otpFlowSignOut = false;
            return;
          }
          clearAuthState(true);
          return;
        }

        if (event === 'TOKEN_REFRESHED' && !session) {
          clearAuthState(true);
          return;
        }

        if (event === 'PASSWORD_RECOVERY') return;

        // Skip if login() is already mid-flight — it handles hydration itself,
        // and letting this race would break the OTP page's navigation.
        if (event === 'SIGNED_IN' && loginInProgress.current) return;

        if (session?.user) {
          await hydrateUserFromSession(session.user);
        } else {
          clearAuthState(true);
        }
      }
    );

    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          await supabase.auth.signOut();
          clearAuthState(false);
          return;
        }
        if (session?.user) {
          await hydrateUserFromSession(session.user);
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Session init error:', err);
        await supabase.auth.signOut();
        clearAuthState(false);
      } finally {
        initialized.current = true;
      }
    };

    initSession();
    return () => subscription.unsubscribe();
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ error: string | null; profile: UserProfile | null }> => {
    try {
      loginInProgress.current = true;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        loginInProgress.current = false;
        return { error: error.message, profile: null };
      }

      if (data.user) {
        const userProfile = await hydrateUserFromSession(data.user);
        loginInProgress.current = false;
        return { error: null, profile: userProfile };
      }

      loginInProgress.current = false;
      return { error: 'No user returned', profile: null };
    } catch (err: any) {
      console.error('Login error:', err);
      loginInProgress.current = false;
      return { error: 'An unexpected error occurred. Please try again.', profile: null };
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
      navigate('/', { replace: true });
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

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      login,
      logout,
      refreshProfile,
      isAuthenticated: !!user,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};