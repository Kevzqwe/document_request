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
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]           = useState<AuthUser | null>(null);
  const [profile, setProfile]     = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate                  = useNavigate();
  const initialized               = useRef(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

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

  // ── Auth state listener + session init ────────────────────────────────────

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Wait until initSession() has run first
        if (!initialized.current) return;

        if (event === 'SIGNED_OUT') {
          clearAuthState(true);
          return;
        }

        if (event === 'TOKEN_REFRESHED' && !session) {
          clearAuthState(true);
          return;
        }

        if (event === 'PASSWORD_RECOVERY') return;

        // Use setTimeout to avoid Supabase internal deadlock on SIGNED_IN.
        // login() also calls hydrateUserFromSession directly, so this path
        // only matters for token refresh / external sign-ins.
        if (session?.user) {
          setTimeout(async () => {
            await hydrateUserFromSession(session.user);
          }, 0);
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

  // ── login() — called from OtpVerification after OTP passes ───────────────
  // Signs in with Supabase, hydrates context (sets user + profile),
  // then navigates. The profile useEffect in OtpVerification detects the
  // profile change and also navigates — whichever fires first is fine since
  // both go to the same path.

  const login = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };

      if (data.user) {
        const userProfile = await hydrateUserFromSession(data.user);
        if (userProfile) {
          navigate(getRedirectPath(userProfile.role), { replace: true });
        }
      }

      return { error: null };
    } catch (err: any) {
      console.error('Login error:', err);
      return { error: 'An unexpected error occurred. Please try again.' };
    }
  };

  // ── logout ────────────────────────────────────────────────────────────────

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

  // ── refreshProfile ────────────────────────────────────────────────────────

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
