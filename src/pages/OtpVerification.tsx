import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, RefreshCw } from 'lucide-react';
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
    expiresAt,
  } = (location.state as {
    userId: string;
    email: string;
    password: string;
    expiresAt?: string;
  }) || {};

  const [otp, setOtp]               = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [timeLeft, setTimeLeft]       = useState<number>(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect away if accessed directly without state
  useEffect(() => {
    if (!userId || !email) {
      navigate('/signup', { replace: true });
    }
  }, [userId, email, navigate]);

  // Countdown timer
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

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

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
    const next = [...otp];
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
        body:    JSON.stringify({ userId, otp: code }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Invalid OTP', description: data.error || 'The code you entered is incorrect.', variant: 'destructive' });
        setIsVerifying(false);
        return;
      }

      // OTP verified — sign the user in now
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        toast({ title: 'Sign-in failed', description: signInError.message, variant: 'destructive' });
        setIsVerifying(false);
        return;
      }

      toast({ title: 'Account verified!', description: 'Welcome to PCS Document Request System.' });
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

      const res = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey },
        // Only email is needed; no contactNumber since this is email OTP
        body:    JSON.stringify({ userId, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Failed to resend OTP', description: data.error, variant: 'destructive' });
      } else {
        toast({ title: 'OTP Resent', description: 'A new code has been sent to your email.' });
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsResending(false);
    }
  };

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
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl text-center">Verify Your Email</CardTitle>
            <p className="text-center text-muted-foreground text-sm">
              We sent a 6-digit code to<br />
              <span className="font-semibold text-foreground">{email}</span>
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* OTP inputs */}
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
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
                  className="w-12 h-14 text-center text-xl font-bold border-2 rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all bg-background"
                />
              ))}
            </div>

            {/* Timer */}
            {timeLeft > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Code expires in <span className="font-semibold text-foreground">{formatTime(timeLeft)}</span>
              </p>
            )}
            {timeLeft === 0 && expiresAt && (
              <p className="text-center text-sm text-destructive font-medium">
                Code has expired. Please request a new one.
              </p>
            )}

            {/* Verify button */}
            <Button
              onClick={handleVerify}
              className="w-full h-12 text-base font-semibold"
              disabled={isVerifying || otp.join('').length < OTP_LENGTH}
            >
              {isVerifying
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</>
                : 'Verify & Continue'}
            </Button>

            {/* Resend */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Didn't receive the code?</p>
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