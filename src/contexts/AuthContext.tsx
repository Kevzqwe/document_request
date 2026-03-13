import React, { createContext, useContext, useState, useEffect } from 'react';
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

  useEffect(() => {
    // Listen for auth state changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const authUser: AuthUser = {
            id: session.user.id,
            email: session.user.email || '',
          };
          setUser(authUser);

          // Fetch profile with setTimeout to avoid deadlock with Supabase
          setTimeout(async () => {
            const userProfile = await fetchUserProfile(session.user.id);
            setProfile(userProfile);
            setIsLoading(false);
          }, 0);
        } else {
          setUser(null);
          setProfile(null);
          setIsLoading(false);
        }
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const authUser: AuthUser = {
          id: session.user.id,
          email: session.user.email || '',
        };
        setUser(authUser);
        const userProfile = await fetchUserProfile(session.user.id);
        setProfile(userProfile);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email || '',
      };
      setUser(authUser);

      const userProfile = await fetchUserProfile(data.user.id);
      setProfile(userProfile);

      if (userProfile) {
        const redirectPath = getRedirectPath(userProfile.role);
        navigate(redirectPath);
      }
    }

    return { error: null };
  };

  const refreshProfile = async () => {
    if (user) {
      const userProfile = await fetchUserProfile(user.id);
      setProfile(userProfile);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    navigate('/');
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
