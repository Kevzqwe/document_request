import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, RefreshCw, ShieldAlert } from 'lucide-react';
import pcsLogo from '@/assets/PCSlogo.png';
import { supabase } from '@/integrations/supabase/client';

const OTP_LENGTH = 6;

const OtpVerification = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State passed from Signup page
  const {
    userId,
    email,
    password,
    expiresAt: initialExpiresAt,
  } = (location.state as {
    userId: string;
    email: string;
    password: string;
    expiresAt?: string;
  }) || {};

  const [otp, setOtp]                   = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying]   = useState(false);
  const [isResending, setIsResending]   = useState(false);
  const [timeLeft, setTimeLeft]         = useState<number>(0);
  const [expiresAt, setExpiresAt]       = useState<string | undefined>(initialExpiresAt);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [isLocked, setIsLocked]         = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if accessed directly without state
  useEffect(() => {
    if (!userId || !email) {
      navigate('/signup', { replace: true });
    }
  }, [userId, email, navigate]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Countdown timer — restarts when expiresAt changes (after resend)
  useEffect(() => {
    if (!expiresAt) return;
    const end = new Date(expiresAt).getTime();
    const tick = () => {
      const diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setTimeLeft(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setOtp(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      toast({ title: 'Incomplete OTP', description: 'Please enter all 6 digits.', variant: 'destructive' });
      return;
    }

    setIsVerifying(true);
    try {
      const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey },
        // ✅ Matches backend field name: otpCode
        body:    JSON.stringify({ userId, otpCode: code }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.locked) {
          // Account locked — show lock state, let user resend to unlock
          setIsLocked(true);
          setAttemptsLeft(0);
          toast({ title: 'Account Locked', description: data.error, variant: 'destructive' });
        } else {
          // Wrong code — show remaining attempts
          if (typeof data.remaining === 'number') setAttemptsLeft(data.remaining);
          toast({
            title:       'Incorrect Code',
            description: data.error || 'The code you entered is incorrect.',
            variant:     'destructive',
          });
        }
        setOtp(Array(OTP_LENGTH).fill(''));
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
        setIsVerifying(false);
        return;
      }

      // ✅ OTP correct — sign the user in
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        toast({ title: 'Sign-in failed', description: signInError.message, variant: 'destructive' });
        setIsVerifying(false);
        return;
      }

      toast({ title: 'Email verified!', description: 'Welcome to PCS Document Request System.' });
      navigate('/student/dashboard', { replace: true });

    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // No contactNumber → backend will skip SMS and only send email
      const res = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey },
        body:    JSON.stringify({ userId, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Failed to resend', description: data.error, variant: 'destructive' });
      } else {
        toast({ title: 'Code Resent', description: 'A new verification code has been sent to your email.' });
        // Reset everything for a fresh attempt
        setOtp(Array(OTP_LENGTH).fill(''));
        setAttemptsLeft(null);
        setIsLocked(false);
        if (data.expiresAt) setExpiresAt(data.expiresAt);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsResending(false);
    }
  };

  const isExpired = timeLeft === 0 && !!expiresAt;

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
          <CardHeader className="space-y-4 pb-6">
            <div className="flex justify-center lg:hidden">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center p-2 shadow-lg">
                <img src={pcsLogo} alt="PCS Logo" className="w-full h-full object-contain" />
              </div>
            </div>
            <div className="flex justify-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isLocked ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                {isLocked
                  ? <ShieldAlert className="w-8 h-8 text-destructive" />
                  : <Mail className="w-8 h-8 text-primary" />}
              </div>
            </div>
            <CardTitle className="text-3xl text-center">
              {isLocked ? 'Account Locked' : 'Verify Your Email'}
            </CardTitle>
            <p className="text-center text-muted-foreground text-sm">
              {isLocked
                ? 'Too many failed attempts. Click "Resend Code" to get a new code and try again.'
                : <><span>We sent a 6-digit code to</span><br /><span className="font-semibold text-foreground">{email}</span></>}
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* OTP inputs */}
            <div
              className={`flex gap-2 justify-center transition-opacity ${(isLocked || isExpired) ? 'opacity-40 pointer-events-none' : ''}`}
              onPaste={handlePaste}
            >
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  disabled={isLocked || isExpired}
                  className="w-12 h-14 text-center text-xl font-bold border-2 rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                />
              ))}
            </div>

            {/* Status messages */}
            {!isLocked && timeLeft > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Code expires in{' '}
                <span className={`font-semibold ${timeLeft <= 60 ? 'text-destructive' : 'text-foreground'}`}>
                  {formatTime(timeLeft)}
                </span>
              </p>
            )}
            {!isLocked && isExpired && (
              <p className="text-center text-sm text-destructive font-medium">
                Code has expired. Please request a new one below.
              </p>
            )}
            {!isLocked && attemptsLeft !== null && attemptsLeft > 0 && (
              <p className="text-center text-sm text-amber-600 font-medium">
                {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining before lockout.
              </p>
            )}

            {/* Verify button */}
            <Button
              onClick={handleVerify}
              className="w-full h-12 text-base font-semibold"
              disabled={isVerifying || isLocked || isExpired || otp.join('').length < OTP_LENGTH}
            >
              {isVerifying
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</>
                : 'Verify & Continue'}
            </Button>

            {/* Resend */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                {isLocked ? 'Unlock your account by requesting a new code:' : "Didn't receive the code?"}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={isResending}
                className="text-primary hover:text-primary/80"
              >
                {isResending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                  : <><RefreshCw className="w-4 h-4 mr-2" />Resend Code</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OtpVerification;