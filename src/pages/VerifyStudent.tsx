import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Loader2, GraduationCap, BookOpen, ChevronRight, ArrowLeft, Hash, Calendar } from 'lucide-react';
import pcsLogo from '@/assets/PCSlogo.png';

type StudentType = 'alumni' | 'current' | null;

interface SignupState {
  firstName:     string;
  lastName:      string;
  email:         string;
  contactNumber: string;
  password:      string;
}

const VerifyStudent = () => {
  const [studentType, setStudentType]       = useState<StudentType>(null);
  const [studentId, setStudentId]           = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [yearLevel, setYearLevel]           = useState('');
  const [section, setSection]               = useState('');
  const [isLoading, setIsLoading]           = useState(false);

  const navigate  = useNavigate();
  const location  = useLocation();
  const { toast } = useToast();

  // Data passed from Signup page
  const signupData = location.state as SignupState | null;

  // Guard: redirect if arrived without sign-up data
  useEffect(() => {
    if (!signupData) {
      navigate('/signup', { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!signupData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentType) {
      toast({ title: 'Please select your student type', variant: 'destructive' });
      return;
    }

    setIsLoading(true);

    try {
      const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/signup-student`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey':        supabaseAnonKey,
        },
        body: JSON.stringify({
          email:          signupData.email,
          password:       signupData.password,
          first_name:     signupData.firstName,
          last_name:      signupData.lastName,
          contact_number: signupData.contactNumber,
          // Student verification fields
          student_type:   studentType,
          student_id:     studentId,
          ...(studentType === 'alumni'
            ? { graduation_year: graduationYear }
            : {}),
          ...(studentType === 'current'
            ? { year_level: yearLevel, section }
            : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Signup failed', description: data.error, variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      toast({
        title:       'Check your email',
        description: 'A verification code has been sent to your email address.',
      });

      // Navigate to OTP page — pass password so OtpVerification can sign in after verify
      navigate('/otp-verify', {
        state: {
          userId:    data.userId,
          email:     signupData.email,
          password:  signupData.password,
          expiresAt: data.expiresAt,
        },
      });

    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setIsLoading(false);
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

        {/* Right — Verification form */}
        <Card className="w-full shadow-2xl border-2">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex justify-center lg:hidden">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center p-2 shadow-lg">
                <img src={pcsLogo} alt="PCS Logo" className="w-full h-full object-contain" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Student Verification</CardTitle>
            <p className="text-center text-muted-foreground text-sm">
              Help us verify your student status at Pateros Catholic School
            </p>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold">1</div>
                <span className="text-xs text-muted-foreground">Account</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">2</div>
                <span className="text-xs font-medium text-primary">Verification</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold">3</div>
                <span className="text-xs text-muted-foreground">OTP</span>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Student type selector */}
              <div className="space-y-2">
                <Label>I am a…</Label>
                <div className="grid grid-cols-2 gap-3">

                  {/* Alumni card */}
                  <button
                    type="button"
                    onClick={() => setStudentType('alumni')}
                    className={`
                      relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-200
                      ${studentType === 'alumni'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/40 hover:bg-muted/50'}
                    `}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors
                      ${studentType === 'alumni' ? 'bg-primary/10' : 'bg-muted'}`}>
                      <GraduationCap className={`w-6 h-6 ${studentType === 'alumni' ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${studentType === 'alumni' ? 'text-primary' : ''}`}>Alumni</p>
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5">I have already graduated</p>
                    </div>
                    {studentType === 'alumni' && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>

                  {/* Current student card */}
                  <button
                    type="button"
                    onClick={() => setStudentType('current')}
                    className={`
                      relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-200
                      ${studentType === 'current'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/40 hover:bg-muted/50'}
                    `}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors
                      ${studentType === 'current' ? 'bg-primary/10' : 'bg-muted'}`}>
                      <BookOpen className={`w-6 h-6 ${studentType === 'current' ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${studentType === 'current' ? 'text-primary' : ''}`}>Current Student</p>
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5">I am currently enrolled</p>
                    </div>
                    {studentType === 'current' && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Shared field — Student ID */}
              {studentType && (
                <div className="space-y-2">
                  <Label htmlFor="studentId">Student ID Number</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="studentId"
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="pl-10 h-11 text-sm"
                      placeholder="e.g. 2024-00123"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Alumni-specific field */}
              {studentType === 'alumni' && (
                <div className="space-y-2">
                  <Label htmlFor="graduationYear">Year Graduated</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="graduationYear"
                      type="number"
                      min="1950"
                      max={new Date().getFullYear()}
                      value={graduationYear}
                      onChange={(e) => setGraduationYear(e.target.value)}
                      className="pl-10 h-11 text-sm"
                      placeholder={`e.g. ${new Date().getFullYear() - 1}`}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Current student-specific fields */}
              {studentType === 'current' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="yearLevel">Year Level</Label>
                    <select
                      id="yearLevel"
                      value={yearLevel}
                      onChange={(e) => setYearLevel(e.target.value)}
                      className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      required
                    >
                      <option value="" disabled>Select year</option>
                      <option value="Grade 7">Grade 7</option>
                      <option value="Grade 8">Grade 8</option>
                      <option value="Grade 9">Grade 9</option>
                      <option value="Grade 10">Grade 10</option>
                      <option value="Grade 11">Grade 11</option>
                      <option value="Grade 12">Grade 12</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="section">Section</Label>
                    <Input
                      id="section"
                      type="text"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      className="h-11 text-sm"
                      placeholder="e.g. St. Thomas"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold mt-1"
                disabled={isLoading || !studentType}
              >
                {isLoading
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
                  : 'Submit & Continue'}
              </Button>

              {/* Back link */}
              <Link
                to="/signup"
                state={signupData}
                className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign up
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VerifyStudent;