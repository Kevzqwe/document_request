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
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate      = useNavigate();
  const initialized   = useRef(false);  // ✅ guard against double fetch on mount
  const signingOutRef = useRef(false);  // ✅ guard against mid-login signOut triggering redirect

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
      id:    sessionUser.id,
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

        // ✅ Ignore SIGNED_OUT fired by the mid-login signOut in Login.tsx (OTP flow)
        if (event === 'SIGNED_OUT') {
          if ((window as any).__otpFlowSignOut) {
            // This is the intentional OTP-flow sign-out — do NOT redirect
            (window as any).__otpFlowSignOut = false;
            return;
          }
          // Real sign-out (logout button, token expiry, etc.)
          await clearAuthState();
          return;
        }

        // ✅ Handle token expiry with no session
        if (event === 'TOKEN_REFRESHED' && !session) {
          await clearAuthState();
          return;
        }

        // ✅ Handle password recovery or user updates
        if (event === 'PASSWORD_RECOVERY') {
          return;
        }

        if (session?.user) {
          await hydrateUserFromSession(session.user);
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
          signingOutRef.current = true;
          await supabase.auth.signOut();
          await clearAuthState(false); // don't redirect — user is already on login
          return;
        }

        if (session?.user) {
          await hydrateUserFromSession(session.user);
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Unexpected error during session init:', err);
        signingOutRef.current = true;
        await supabase.auth.signOut();
        await clearAuthState(false);
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
      // ✅ Mark as intentional full logout (not OTP mid-flow)
      signingOutRef.current = false;
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

  // ✅ Expose signingOutRef setter so Login.tsx can flag the OTP mid-flow signOut
  // This is consumed internally — no need to expose via context

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