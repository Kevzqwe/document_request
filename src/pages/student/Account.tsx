import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { User, Phone, GraduationCap, Edit2, Save, X, Camera, LogOut, Loader2, Lock } from 'lucide-react';
import { profileStorage } from '@/lib/profileStorage';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog, AlertDialogAction, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

const Account = () => {
  const { profile, user, logout, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── Contact number error modal ────────────────────────────────────────────
  const [contactErrorOpen,    setContactErrorOpen]    = useState(false);
  const [contactErrorMessage, setContactErrorMessage] = useState('');

  const [editedInfo, setEditedInfo] = useState({
    firstName: profile?.firstName || '',
    middleName: profile?.middleName || '',
    lastName: profile?.lastName || '',
    contactNumber: profile?.contactNumber || '',
  });

  useEffect(() => {
    if (user?.id) {
      if (profile?.avatarUrl) {
        setAvatarUrl(profile.avatarUrl);
      } else {
        const savedProfile = profileStorage.getByUserId(user.id);
        if (savedProfile?.avatarUrl) setAvatarUrl(savedProfile.avatarUrl);
      }
      setEditedInfo({
        firstName:     profile?.firstName     || '',
        middleName:    profile?.middleName    || '',
        lastName:      profile?.lastName      || '',
        contactNumber: profile?.contactNumber || '',
      });
    }
  }, [user?.id, profile]);

  const displayAvatarUrl = profileStorage.getAvatarUrl(avatarUrl, profile?.firstName);

  const [stats, setStats] = useState({ total: 0, approved: 0, completed: 0, pending: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('document_requests')
        .select('status')
        .eq('user_id', user.id);
      if (data) {
        const completed = data.filter(r => r.status === 'Completed').length;
        const approved  = data.filter(r => r.status === 'Approved' || r.status === 'Ready').length;
        const pending   = data.filter(r => r.status === 'Processing' || r.status === 'pending').length;
        setStats({ total: data.length, approved, completed, pending });
      }
    };
    fetchStats();
  }, [user?.id]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setIsUploadingAvatar(true);
    try {
      const newAvatarUrl = await profileStorage.uploadAvatar(user.id, file);
      setAvatarUrl(newAvatarUrl);
      await supabase.from('students').update({ avatar_url: newAvatarUrl }).eq('user_id', user.id);
      profileStorage.save({
        userId: user.id,
        avatarUrl: newAvatarUrl,
        firstName: editedInfo.firstName,
        lastName: editedInfo.lastName,
        middleName: editedInfo.middleName,
        contactNumber: editedInfo.contactNumber,
      });
      await refreshProfile();
      window.dispatchEvent(new CustomEvent('avatarUpdated', { detail: { avatarUrl: newAvatarUrl } }));
      toast({ title: 'Photo Updated', description: 'Your profile photo has been saved.' });
    } catch {
      toast({ title: 'Upload Failed', description: 'Failed to upload photo. Please try again.', variant: 'destructive' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    // ── Normalize & validate contact number ──────────────────────────────
    let contact = editedInfo.contactNumber || '';
    if (contact) {
      // Auto-fix: "9xxxxxxxxx" (10 digits) → "09xxxxxxxxx"
      if (contact.startsWith('9') && contact.length === 10) contact = '0' + contact;
      if (contact.length !== 11) {
        setContactErrorMessage('Failed to save: number must be 11 digits.');
        setContactErrorOpen(true);
        return;
      }
    }

    // Validate password if provided
    if (newPassword) {
      if (newPassword.length < 6) {
        toast({ title: 'Weak Password', description: 'Password must be at least 6 characters.', variant: 'destructive' });
        return;
      }
      if (newPassword !== confirmPassword) {
        toast({ title: 'Password Mismatch', description: 'Passwords do not match.', variant: 'destructive' });
        return;
      }
    }

    setIsSaving(true);

    // Update profile in database
    const { error } = await supabase
      .from('students')
      .update({
        first_name:     editedInfo.firstName,
        middle_name:    editedInfo.middleName  || null,
        last_name:      editedInfo.lastName,
        contact_number: contact || null,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update profile.', variant: 'destructive' });
      setIsSaving(false);
      return;
    }

    // Sync normalized number back into form state
    setEditedInfo(prev => ({ ...prev, contactNumber: contact }));

    // ✅ Update password with fresh session to avoid 400 error
    if (newPassword) {
      try {
        // Refresh session first to ensure token is valid
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !refreshed?.session) {
          toast({ title: 'Session Expired', description: 'Please log out and log in again to change your password.', variant: 'destructive' });
          setIsSaving(false);
          return;
        }

        const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });

        if (pwError) {
          toast({ title: 'Password Error', description: pwError.message, variant: 'destructive' });
          setIsSaving(false);
          return;
        }

        toast({ title: 'Password Updated', description: 'Your password has been changed successfully.' });
      } catch (err: any) {
        toast({ title: 'Password Error', description: err.message || 'Failed to update password.', variant: 'destructive' });
        setIsSaving(false);
        return;
      }
    }

    profileStorage.save({
      userId: user.id,
      avatarUrl,
      firstName:     editedInfo.firstName,
      lastName:      editedInfo.lastName,
      middleName:    editedInfo.middleName,
      contactNumber: contact,
    });

    await refreshProfile();
    window.dispatchEvent(new CustomEvent('profileUpdated'));

    toast({ title: 'Profile Updated', description: 'Your information has been successfully saved.' });
    setIsEditing(false);
    setNewPassword('');
    setConfirmPassword('');
    setIsSaving(false);
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => logout(), 500);
  };

  const handleCancel = () => {
    if (user?.id) {
      const savedProfile = profileStorage.getByUserId(user.id);
      setEditedInfo({
        firstName:     savedProfile?.firstName     || profile?.firstName     || '',
        middleName:    savedProfile?.middleName    || profile?.middleName    || '',
        lastName:      savedProfile?.lastName      || profile?.lastName      || '',
        contactNumber: savedProfile?.contactNumber || profile?.contactNumber || '',
      });
    } else {
      setEditedInfo({
        firstName:     profile?.firstName     || '',
        middleName:    profile?.middleName    || '',
        lastName:      profile?.lastName      || '',
        contactNumber: profile?.contactNumber || '',
      });
    }
    setNewPassword('');
    setConfirmPassword('');
    setIsEditing(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-2 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 border-b">
          <div className="flex items-center gap-4 justify-between flex-wrap">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <img
                  key={displayAvatarUrl}
                  src={displayAvatarUrl}
                  alt={profile?.firstName}
                  className="w-20 h-20 rounded-full border-4 border-primary shadow-lg object-cover"
                />
                {isEditing && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    type="button"
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar
                      ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                      : <Camera  className="w-6 h-6 text-white" />}
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {profile?.firstName} {profile?.middleName ? profile.middleName + ' ' : ''}{profile?.lastName}
                </CardTitle>
                <p className="text-muted-foreground font-mono">
                  {profile?.studentId ? `ID: ${profile.studentId}` : 'No Student ID'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} variant="outline">
                  <Edit2 className="w-4 h-4 mr-2" />Edit
                </Button>
              ) : (
                <>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button onClick={handleCancel} variant="outline" disabled={isSaving}>
                    <X className="w-4 h-4 mr-2" />Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground"><User className="w-4 h-4" />First Name</Label>
              <Input
                value={editedInfo.firstName}
                disabled={!isEditing}
                onChange={(e) => setEditedInfo({ ...editedInfo, firstName: e.target.value.replace(/[^a-zA-Z\s]/g, '') })}
                className={isEditing ? 'border-2 font-medium' : 'bg-muted border-2 font-medium'}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground"><User className="w-4 h-4" />Middle Name</Label>
              <Input
                value={editedInfo.middleName}
                disabled={!isEditing}
                onChange={(e) => setEditedInfo({ ...editedInfo, middleName: e.target.value.replace(/[^a-zA-Z\s]/g, '') })}
                className={isEditing ? 'border-2 font-medium' : 'bg-muted border-2 font-medium'}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground"><User className="w-4 h-4" />Last Name</Label>
              <Input
                value={editedInfo.lastName}
                disabled={!isEditing}
                onChange={(e) => setEditedInfo({ ...editedInfo, lastName: e.target.value.replace(/[^a-zA-Z\s]/g, '') })}
                className={isEditing ? 'border-2 font-medium' : 'bg-muted border-2 font-medium'}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" />Contact Number</Label>
              <Input
                value={editedInfo.contactNumber}
                disabled={!isEditing}
                onChange={(e) => setEditedInfo({
                  ...editedInfo,
                  // ✅ Limit to 11 digits
                  contactNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 11),
                })}
                maxLength={11}
                className={isEditing ? 'border-2 font-medium' : 'bg-muted border-2 font-medium'}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground"><User className="w-4 h-4" />Student ID</Label>
              <Input value={profile?.studentId || '—'} disabled className="bg-muted border-2 font-medium" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground"><GraduationCap className="w-4 h-4" />Grade Level</Label>
              <Input value={profile?.gradeLevel || '—'} disabled className="bg-muted border-2 font-medium" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground"><GraduationCap className="w-4 h-4" />Section</Label>
              <Input value={profile?.section || '—'} disabled className="bg-muted border-2 font-medium" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground"><User className="w-4 h-4" />Role</Label>
              <Input value={profile?.role || '—'} disabled className="bg-muted border-2 font-medium capitalize" />
            </div>
          </div>

          {/* ✅ Password change - only shows when editing */}
          {isEditing && (
            <div className="border-t pt-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Change Password <span className="text-sm text-muted-foreground font-normal">(optional)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="border-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className={`border-2 ${confirmPassword && newPassword !== confirmPassword ? 'border-destructive' : ''}`}
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader><CardTitle>Account Statistics</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/30">
              <div className="text-3xl font-bold text-primary mb-1">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Requests</div>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/30">
              <div className="text-3xl font-bold text-primary mb-1">{stats.approved}</div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </div>
            <div className="p-4 bg-warning/10 rounded-lg border-2 border-warning/30">
              <div className="text-3xl font-bold text-warning mb-1">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div className="p-4 bg-success/10 rounded-lg border-2 border-success/30">
              <div className="text-3xl font-bold text-success mb-1">{stats.completed}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Need to update your information?</h3>
            <p className="text-sm text-muted-foreground">
              Contact the Registrar's Office to update your personal information or if you notice any errors in your profile.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleLogout} variant="destructive" className="w-full h-12" disabled={isLoggingOut}>
        {isLoggingOut ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
        {isLoggingOut ? 'Logging out...' : 'Logout'}
      </Button>

      {/* ── Contact Number Error Modal ─────────────────────────────────────── */}
      <AlertDialog open={contactErrorOpen} onOpenChange={setContactErrorOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />Invalid Contact Number
            </AlertDialogTitle>
            <AlertDialogDescription>{contactErrorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setContactErrorOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Account;