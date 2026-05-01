import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Loader2, RefreshCw, ArrowLeft } from 'lucide-react';
import pcsLogo from '@/assets/PCSlogo.png';
import { supabase } from '@/integrations/supabase/client';
import { getRedirectPath } from '@/lib/auth';

interface OtpLocationState {
  userId:        string;
  email:         string;
  password:      string;
  contactNumber: string;
  expiresAt?:    string;
  locked?:       boolean;
  lockedUntil?:  string;
}

const OtpVerification = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { toast } = useToast();
  const { login, profile } = useAuth();

  const state = location.state as OtpLocationState | null;

  // Redirect to login if no state (direct URL access)
  useEffect(() => {
    if (!state?.userId || !state?.email) {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  // Redirect if already logged in
  useEffect(() => {
    if (profile) navigate(getRedirectPath(profile.role), { replace: true });
  }, [profile, navigate]);

  const [otp, setOtp]                     = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying]     = useState(false);
  const [isResending, setIsResending]     = useState(false);
  const [otpCountdown, setOtpCountdown]   = useState(300);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [attemptsLeft, setAttemptsLeft]   = useState(5);
  const [lockedUntil, setLockedUntil]     = useState<Date | null>(
    state?.lockedUntil ? new Date(state.lockedUntil) : null
  );
  const [lockCountdown, setLockCountdown] = useState(0);

  const otpRefs    = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Countdown timers ──────────────────────────────────────────────────────
  useEffect(() => {
    if (state?.expiresAt) {
      const remaining = Math.ceil((new Date(state.expiresAt).getTime() - Date.now()) / 1000);
      setOtpCountdown(Math.max(0, remaining));
    }

    if (state?.locked && state?.lockedUntil) {
      const remaining = Math.ceil((new Date(state.lockedUntil).getTime() - Date.now()) / 1000);
      setLockCountdown(Math.max(0, remaining));
    }

    timerRef.current = setInterval(() => {
      setOtpCountdown(prev => Math.max(0, prev - 1));
      setResendCooldown(prev => Math.max(0, prev - 1));

      if (lockedUntil) {
        const rem = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
        setLockCountdown(Math.max(0, rem));
        if (rem <= 0) setLockedUntil(null);
      }
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lockedUntil]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // ── OTP input handlers ────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next   = [...otp];
    pasted.split('').forEach((c, i) => { if (i < 6) next[i] = c; });
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      toast({ title: 'Enter all 6 digits', variant: 'destructive' });
      return;
    }

    setIsVerifying(true);

    try {
      const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey },
        body:    JSON.stringify({ userId: state!.userId, otpCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.locked) {
          setLockedUntil(new Date(data.lockedUntil));
          setLockCountdown(Math.ceil((new Date(data.lockedUntil).getTime() - Date.now()) / 1000));
        } else if (data.remaining !== undefined) {
          setAttemptsLeft(data.remaining);
          setOtp(['', '', '', '', '', '']);
          otpRefs.current[0]?.focus();
        }
        toast({ title: 'Verification Failed', description: data.error, variant: 'destructive' });
        setIsVerifying(false);
        return;
      }

      // ── OTP correct — complete the login ──────────────────────────────
      const { error: loginError } = await login(state!.email, state!.password);
      if (loginError) {
        toast({ title: 'Login error', description: loginError, variant: 'destructive' });
        setIsVerifying(false);
        return;
      }

      toast({ title: 'Login Successful', description: 'Welcome back!' });
      // Navigation handled by AuthContext via getRedirectPath

    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setIsVerifying(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (isResending || lockedUntil || resendCooldown > 0) return;
    setIsResending(true);

    try {
      const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey },
        body:    JSON.stringify({
          userId:        state!.userId,
          email:         state!.email,
          contactNumber: state!.contactNumber,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.locked) {
          setLockedUntil(new Date(data.lockedUntil));
          setLockCountdown(Math.ceil((new Date(data.lockedUntil).getTime() - Date.now()) / 1000));
        }
        toast({ title: 'Failed to resend', description: data.error, variant: 'destructive' });
      } else {
        setOtp(['', '', '', '', '', '']);
        setOtpCountdown(300);
        setResendCooldown(60);
        setAttemptsLeft(5);
        otpRefs.current[0]?.focus();
        toast({ title: 'OTP Resent', description: data.message });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }

    setIsResending(false);
  };

  if (!state?.userId) return null;

  const isLocked   = !!lockedUntil && lockCountdown > 0;
  const isExpired  = otpCountdown === 0;
  const canSubmit  = otp.join('').length === 6 && !isLocked && !isExpired && !isVerifying;
  const canResend  = !isResending && !isLocked && resendCooldown === 0;

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

        {/* Right — OTP form */}
        <Card className="w-full shadow-2xl border-2">
          <CardHeader className="space-y-4 pb-2">
            <div className="flex justify-center lg:hidden mb-2">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center p-2 shadow-lg">
                <img src={pcsLogo} alt="PCS Logo" className="w-full h-full object-contain" />
              </div>
            </div>

            {/* Shield icon */}
            <div className="flex justify-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                isLocked ? 'bg-destructive/10' : 'bg-primary/10'
              }`}>
                <ShieldCheck className={`w-10 h-10 ${isLocked ? 'text-destructive' : 'text-primary'}`} />
              </div>
            </div>

            <CardTitle className="text-2xl text-center">
              {isLocked ? 'Account Temporarily Locked' : 'Two-Factor Verification'}
            </CardTitle>
            <p className="text-center text-muted-foreground text-sm px-4">
              {isLocked
                ? 'Too many failed attempts. Please wait before trying again.'
                : <>
                    A 6-digit OTP was sent to <span className="font-semibold text-foreground">{state.email}</span>
                    {state.contactNumber && (
                      <> and <span className="font-semibold text-foreground">••••{state.contactNumber.slice(-4)}</span></>
                    )}
                  </>
              }
            </p>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleVerify} className="space-y-6">

              {/* Lock countdown banner */}
              {isLocked && (
                <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-center space-y-1">
                  <p className="text-destructive font-semibold">🔒 Account Locked</p>
                  <p className="text-destructive/80 text-sm">
                    Unlocks in <span className="font-mono font-bold text-lg">{formatTime(lockCountdown)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Too many incorrect OTP attempts</p>
                </div>
              )}

              {/* OTP expiry */}
              {!isLocked && (
                <div className={`text-center text-sm font-medium ${
                  otpCountdown < 60 ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {isExpired
                    ? <span className="text-destructive">⏱ OTP expired — request a new one below</span>
                    : <>Code expires in <span className="font-mono font-bold">{formatTime(otpCountdown)}</span></>
                  }
                </div>
              )}

              {/* 6-digit OTP boxes */}
              <div className="flex justify-center gap-3">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => { otpRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    disabled={isLocked || isExpired}
                    autoFocus={index === 0}
                    className={`w-12 h-16 text-center text-2xl font-bold border-2 rounded-xl
                      focus:outline-none transition-all
                      ${digit ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'}
                      ${isLocked || isExpired ? 'opacity-40 cursor-not-allowed bg-muted' : 'hover:border-primary/50'}
                    `}
                  />
                ))}
              </div>

              {/* Attempts warning */}
              {attemptsLeft < 5 && !isLocked && (
                <div className="text-center p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-700 text-sm font-medium">
                    ⚠️ {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining before 5-minute lock
                  </p>
                </div>
              )}

              {/* Verify button */}
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold"
                disabled={!canSubmit}
              >
                {isVerifying
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</>
                  : 'Verify & Login'}
              </Button>

              {/* Footer actions */}
              <div className="flex items-center justify-between text-sm pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={!canResend}
                  className="flex items-center gap-1.5 text-primary hover:text-primary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isResending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RefreshCw className="w-3.5 h-3.5" />
                  }
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend OTP'
                  }
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OtpVerification;