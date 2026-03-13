import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Phone, GraduationCap, Edit2, Save, X, Camera, LogOut, Loader2 } from 'lucide-react';
import { profileStorage } from '@/lib/profileStorage';
import { supabase } from '@/integrations/supabase/client';

const Account = () => {
  const { profile, user, logout, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editedInfo, setEditedInfo] = useState({
    firstName: profile?.firstName || '',
    middleName: profile?.middleName || '',
    lastName: profile?.lastName || '',
    contactNumber: profile?.contactNumber || '',
  });

  // Load saved profile data on mount
  useEffect(() => {
    if (user?.id) {
      // Prefer avatar from database profile
      if (profile?.avatarUrl) {
        setAvatarUrl(profile.avatarUrl);
      } else {
        const savedProfile = profileStorage.getByUserId(user.id);
        if (savedProfile?.avatarUrl) {
          setAvatarUrl(savedProfile.avatarUrl);
        }
      }
      setEditedInfo({
        firstName: profile?.firstName || '',
        middleName: profile?.middleName || '',
        lastName: profile?.lastName || '',
        contactNumber: profile?.contactNumber || '',
      });
    }
  }, [user?.id, profile]);

  // Get the display avatar URL
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
        const approved = data.filter(r => r.status === 'Approved' || r.status === 'Ready').length;
        const pending = data.filter(r => r.status === 'Processing' || r.status === 'pending').length;
        setStats({ total: data.length, approved, completed, pending });
      }
    };
    fetchStats();
  }, [user?.id]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user?.id) {
      setIsUploadingAvatar(true);
      try {
        const newAvatarUrl = await profileStorage.uploadAvatar(user.id, file);
        setAvatarUrl(newAvatarUrl);

        // Save avatar_url to the database
        await supabase
          .from('students')
          .update({ avatar_url: newAvatarUrl })
          .eq('user_id', user.id);

        profileStorage.save({
          userId: user.id,
          avatarUrl: newAvatarUrl,
          firstName: editedInfo.firstName,
          lastName: editedInfo.lastName,
          middleName: editedInfo.middleName,
          contactNumber: editedInfo.contactNumber,
        });

        await refreshProfile();
        window.dispatchEvent(new Event('avatarUpdated'));
        
        toast({
          title: 'Photo Updated',
          description: 'Your profile photo has been saved.',
        });
      } catch (error) {
        toast({
          title: 'Upload Failed',
          description: 'Failed to upload photo. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsUploadingAvatar(false);
      }
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    
    setIsSaving(true);
    
    // Save to database
    const { error } = await supabase
      .from('students')
      .update({
        first_name: editedInfo.firstName,
        middle_name: editedInfo.middleName || null,
        last_name: editedInfo.lastName,
        contact_number: editedInfo.contactNumber || null,
      })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile.',
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }
    
    // Also save to localStorage for avatar/offline
    profileStorage.save({
      userId: user.id,
      avatarUrl: avatarUrl,
      firstName: editedInfo.firstName,
      lastName: editedInfo.lastName,
      middleName: editedInfo.middleName,
      contactNumber: editedInfo.contactNumber,
    });
    
    // Refresh profile in AuthContext so welcome name updates
    await refreshProfile();
    
    window.dispatchEvent(new CustomEvent('profileUpdated'));
    
    toast({
      title: 'Profile Updated',
      description: 'Your information has been successfully saved.',
    });
    setIsEditing(false);
    setIsSaving(false);
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      logout();
    }, 500);
  };

  const handleCancel = () => {
    // Restore from localStorage first, then fall back to profile
    if (user?.id) {
      const savedProfile = profileStorage.getByUserId(user.id);
      setEditedInfo({
        firstName: savedProfile?.firstName || profile?.firstName || '',
        middleName: savedProfile?.middleName || profile?.middleName || '',
        lastName: savedProfile?.lastName || profile?.lastName || '',
        contactNumber: savedProfile?.contactNumber || profile?.contactNumber || '',
      });
    } else {
      setEditedInfo({
        firstName: profile?.firstName || '',
        middleName: profile?.middleName || '',
        lastName: profile?.lastName || '',
        contactNumber: profile?.contactNumber || '',
      });
    }
    setIsEditing(false);
  };

  const editableFields = [
    {
      label: 'First Name',
      value: editedInfo.firstName,
      field: 'firstName',
      icon: User,
      editable: true,
    },
    {
      label: 'Middle Name',
      value: editedInfo.middleName,
      field: 'middleName',
      icon: User,
      editable: true,
    },
    {
      label: 'Last Name',
      value: editedInfo.lastName,
      field: 'lastName',
      icon: User,
      editable: true,
    },
    {
      label: 'Contact Number',
      value: editedInfo.contactNumber,
      field: 'contactNumber',
      icon: Phone,
      editable: true,
    },
    {
      label: 'Student ID',
      value: profile?.studentId || profile?.username,
      field: 'studentId',
      icon: Mail,
      editable: false,
    },
    {
      label: 'Grade Level',
      value: profile?.gradeLevel,
      field: 'gradeLevel',
      icon: GraduationCap,
      editable: false,
    },
    {
      label: 'Section',
      value: profile?.section,
      field: 'section',
      icon: GraduationCap,
      editable: false,
    },
    {
      label: 'Role',
      value: profile?.role,
      field: 'role',
      icon: User,
      editable: false,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-2 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 border-b">
          <div className="flex items-center gap-4 justify-between flex-wrap">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <img
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
                    {isUploadingAvatar ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6 text-white" />
                    )}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {profile?.firstName} {profile?.middleName ? profile.middleName + ' ' : ''}{profile?.lastName}
                </CardTitle>
                <p className="text-muted-foreground">
                  {profile?.studentId || profile?.username || 'Student'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} variant="outline">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button onClick={handleSave} variant="default" disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button onClick={handleCancel} variant="outline" disabled={isSaving}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {editableFields.map((item, index) => (
              <div key={index} className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Label>
                <Input
                  value={item.value}
                  disabled={!isEditing || !item.editable}
                  onChange={(e) => {
                    if (!isEditing || !item.editable) return;
                    let value = e.target.value;
                    // Filter input based on field type
                    if (['firstName', 'middleName', 'lastName'].includes(item.field)) {
                      value = value.replace(/[^a-zA-Z\s]/g, ''); // Letters and spaces only
                    } else if (item.field === 'contactNumber') {
                      value = value.replace(/[^0-9]/g, ''); // Numbers only
                    }
                    setEditedInfo({ ...editedInfo, [item.field]: value });
                  }}
                  className={
                    isEditing && item.editable
                      ? 'border-2 font-medium'
                      : 'bg-muted border-2 font-medium'
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Account Statistics</CardTitle>
        </CardHeader>
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
              Contact the Registrar's Office to update your personal information or if
              you notice any errors in your profile.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-5">
        <Button onClick={handleLogout} variant="destructive" className="w-full h-12" disabled={isLoggingOut}>
          {isLoggingOut ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4 mr-2" />
          )}
          {isLoggingOut ? 'Logging out...' : 'Logout'}
        </Button>
      </div>
    </div>
  );
};

export default Account;