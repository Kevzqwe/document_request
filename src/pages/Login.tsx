import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Lock, Mail, Eye, EyeOff, Loader2 } from 'lucide-react';
import pcsLogo from '@/assets/PCSlogo.png';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserProfile, getRedirectPath } from '@/lib/auth';

const Login = () => {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);

  const { isAuthenticated, profile, isLoading: authLoading } = useAuth();
  const navigate  = useNavigate();
  const { toast } = useToast();

  // If already fully authenticated, redirect to dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated && profile) {
      navigate(getRedirectPath(profile.role), { replace: true });
    }
  }, [isAuthenticated, profile, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Step 1 — verify credentials with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast({ title: 'Login failed', description: error.message, variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      const userId = data.user.id;

      // Fetch profile to get contact number for SMS OTP
      const userProfile   = await fetchUserProfile(userId);
      const contactNumber = userProfile?.contactNumber || '';

      // Step 2 — flag + sign out so OTP page starts fresh (no active session yet)
      (window as any).__otpFlowSignOut = true;
      await supabase.auth.signOut();

      // Step 3 — send OTP via edge function
      const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey },
        body:    JSON.stringify({ userId, email, contactNumber }),
      });

      const otpData = await res.json();

      if (!res.ok) {
        if (otpData.locked) {
          // Still go to OTP page so lock timer is visible
          navigate('/otp-verify', {
            state: { userId, email, contactNumber, locked: true, lockedUntil: otpData.lockedUntil },
          });
        } else {
          toast({ title: 'Failed to send OTP', description: otpData.error, variant: 'destructive' });
        }
        setIsLoading(false);
        return;
      }

      toast({ title: 'OTP Sent', description: otpData.message });

      // Step 4 — go to OTP page with all state needed to complete login
      navigate('/otp-verify', {
        state: {
          userId,
          email,
          password,       // needed to re-authenticate after OTP passes
          contactNumber,
          expiresAt: otpData.expiresAt,
        },
      });

    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }

    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/70 via-primary-light/60 to-accent/50">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/70 via-primary-light/60 to-accent/50 p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">

        {/* Left — Branding */}
        <div className="hidden lg:flex flex-col items-center justify-center text-white space-y-6 p-12">
          <div className="relative">
            <div className="absolute inset-0 bg-white/20 rounded-full blur-3xl" />
            <img src={pcsLogo} alt="PCS Logo" className="w-64 h-64 relative z-10 drop-shadow-2xl object-contain" />
          </div>
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-bold drop-shadow-lg">Pateros Catholic School</h1>
            <p className="text-xl text-white/90 drop-shadow">Document Request Management System</p>
          </div>
        </div>

        {/* Right — Login form */}
        <Card className="w-full shadow-2xl border-2">
          <CardHeader className="space-y-4 pb-6">
            <div className="flex justify-center lg:hidden">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center p-2 shadow-lg">
                <img src={pcsLogo} alt="PCS Logo" className="w-full h-full object-contain" />
              </div>
            </div>
            <CardTitle className="text-3xl text-center">Welcome Back</CardTitle>
            <p className="text-center text-muted-foreground">Sign in to continue to your account</p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 text-base"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 text-base"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold"
                disabled={isLoading}
              >
                {isLoading
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending OTP...</>
                  : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;