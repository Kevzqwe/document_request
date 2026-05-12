import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Lock, Mail, Eye, EyeOff, User, Phone } from 'lucide-react';
import pcsLogo from '@/assets/PCSlogo.png';

const Signup = () => {
  const [firstName, setFirstName]             = useState('');
  const [lastName, setLastName]               = useState('');
  const [email, setEmail]                     = useState('');
  const [contactNumber, setContactNumber]     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);

  const navigate  = useNavigate();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({
        title:       'Password too short',
        description: 'Password must be at least 8 characters.',
        variant:     'destructive',
      });
      return;
    }

    // Pass credentials to VerifyStudent — API call happens there
    navigate('/verify-student', {
      state: {
        firstName,
        lastName,
        email,
        contactNumber,
        password,
      },
    });
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

        {/* Right — Signup form */}
        <Card className="w-full shadow-2xl border-2">
          <CardHeader className="space-y-4 pb-6">
            <div className="flex justify-center lg:hidden">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center p-2 shadow-lg">
                <img src={pcsLogo} alt="PCS Logo" className="w-full h-full object-contain" />
              </div>
            </div>
            <CardTitle className="text-3xl text-center">Create Account</CardTitle>
            <p className="text-center text-muted-foreground">Fill in your details to get started</p>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">1</div>
                <span className="text-xs font-medium text-primary">Account</span>
              </div>
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold">2</div>
                <span className="text-xs text-muted-foreground">Verification</span>
              </div>
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold">3</div>
                <span className="text-xs text-muted-foreground">OTP</span>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pl-9 h-12 text-base"
                      placeholder="First name"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="pl-9 h-12 text-base"
                      placeholder="Last name"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
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

              {/* Contact Number */}
              <div className="space-y-2">
                <Label htmlFor="contactNumber">Contact Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="contactNumber"
                    type="tel"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="pl-10 h-12 text-base"
                    placeholder="+63 9XX XXX XXXX"
                  />
                </div>
              </div>

              {/* Password */}
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
                    placeholder="Min. 8 characters"
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

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 text-base"
                    placeholder="Re-enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold"
              >
                Continue
              </Button>

              <p className="text-center text-sm text-muted-foreground pt-2">
                Already have an account?{' '}
                <Link to="/" className="font-semibold text-primary hover:underline transition-colors">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Signup;