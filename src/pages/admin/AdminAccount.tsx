import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect } from 'react';
import { User, Mail, Phone, Shield, LogOut, Loader2, Edit2, Camera, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { profileStorage } from '@/lib/profileStorage';
import { supabase } from '@/integrations/supabase/client';

// Map role → table name
const ROLE_TABLE: Record<string, string> = {
  admin:       'admins',
  cashier:     'cashiers',
  programhead: 'programheads',
};

const ROLE_LABELS: Record<string, string> = {
  admin:       'Administrator',
  cashier:     'Cashier',
  programhead: 'Program Head',
  student:     'Student',
};

const AdminAccount = () => {
  const { profile, user, logout, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoggingOut, setIsLoggingOut]     = useState(false);
  const [isEditing, setIsEditing]           = useState(false);
  const [isSaving, setIsSaving]             = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl]           = useState<string | null>(null);
  const [editedInfo, setEditedInfo]         = useState({
    firstName:     profile?.firstName     || '',
    middleName:    profile?.middleName    || '',
    lastName:      profile?.lastName      || '',
    contactNumber: profile?.contactNumber || '',
  });

  useEffect(() => {
    if (user?.id) {
      if (profile?.avatarUrl) {
        setAvatarUrl(profile.avatarUrl);
      } else {
        const saved = profileStorage.getByUserId(user.id);
        if (saved?.avatarUrl) setAvatarUrl(saved.avatarUrl);
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

  // Get the correct table for this role
  const getTable = () => ROLE_TABLE[profile?.role ?? ''] ?? 'admins';

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => logout(), 500);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setIsUploadingAvatar(true);
    try {
      const newAvatarUrl = await profileStorage.uploadAvatar(user.id, file);
      setAvatarUrl(newAvatarUrl);

      await supabase
        .from(getTable())
        .update({ avatar_url: newAvatarUrl })
        .eq('user_id', user.id);

      profileStorage.save({
        userId:        user.id,
        avatarUrl:     newAvatarUrl,
        firstName:     editedInfo.firstName,
        lastName:      editedInfo.lastName,
        middleName:    editedInfo.middleName,
        contactNumber: editedInfo.contactNumber,
      });

      await refreshProfile();
      window.dispatchEvent(new Event('avatarUpdated'));

      toast({ title: 'Photo Updated', description: 'Your profile photo has been saved.' });
    } catch {
      toast({ title: 'Upload Failed', description: 'Failed to upload photo.', variant: 'destructive' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);

    const { error } = await supabase
      .from(getTable())
      .update({
        first_name:     editedInfo.firstName,
        middle_name:    editedInfo.middleName || null,
        last_name:      editedInfo.lastName,
        contact_number: editedInfo.contactNumber || null,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update profile.', variant: 'destructive' });
      setIsSaving(false);
      return;
    }

    profileStorage.save({
      userId:        user.id,
      avatarUrl:     avatarUrl,
      firstName:     editedInfo.firstName,
      lastName:      editedInfo.lastName,
      middleName:    editedInfo.middleName,
      contactNumber: editedInfo.contactNumber,
    });

    await refreshProfile();
    toast({ title: 'Profile Updated', description: 'Your information has been successfully saved.' });
    setIsEditing(false);
    setIsSaving(false);
  };

  const handleCancel = () => {
    setEditedInfo({
      firstName:     profile?.firstName     || '',
      middleName:    profile?.middleName    || '',
      lastName:      profile?.lastName      || '',
      contactNumber: profile?.contactNumber || '',
    });
    setIsEditing(false);
  };

  const accountFields = [
    { label: 'First Name',      value: editedInfo.firstName,     field: 'firstName',     icon: User,   editable: true  },
    { label: 'Middle Name',     value: editedInfo.middleName,    field: 'middleName',    icon: User,   editable: true  },
    { label: 'Last Name',       value: editedInfo.lastName,      field: 'lastName',      icon: User,   editable: true  },
    { label: 'Contact Number',  value: editedInfo.contactNumber, field: 'contactNumber', icon: Phone,  editable: true  },
    { label: 'Username',        value: profile?.username,        field: 'username',      icon: Mail,   editable: false },
    { label: 'Role',            value: ROLE_LABELS[profile?.role ?? ''] ?? profile?.role,
                                                                  field: 'role',          icon: Shield, editable: false },
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
                    {isUploadingAvatar
                      ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                      : <Camera className="w-6 h-6 text-white" />
                    }
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {profile?.firstName} {profile?.middleName ? profile.middleName + ' ' : ''}{profile?.lastName}
                </CardTitle>
                <p className="text-muted-foreground">{profile?.username}</p>
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
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {accountFields.map((item, index) => (
              <div key={index} className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Label>
                <Input
                  value={item.value ?? ''}
                  disabled={!isEditing || !item.editable}
                  onChange={(e) => {
                    if (!isEditing || !item.editable) return;
                    let value = e.target.value;
                    if (['firstName', 'middleName', 'lastName'].includes(item.field)) {
                      value = value.replace(/[^a-zA-Z\s]/g, '');
                    } else if (item.field === 'contactNumber') {
                      value = value.replace(/[^0-9]/g, '');
                    }
                    setEditedInfo({ ...editedInfo, [item.field]: value });
                  }}
                  className={isEditing && item.editable ? 'border-2 font-medium' : 'bg-muted border-2 font-medium cursor-not-allowed'}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Role info card */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/30">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {ROLE_LABELS[profile?.role ?? ''] ?? 'Staff'} Access
            </h3>
            <p className="text-sm text-muted-foreground">
              {profile?.role === 'admin' && 'You have full administrative access to the document request system.'}
              {profile?.role === 'cashier' && 'You have access to payment records and processing.'}
              {profile?.role === 'programhead' && 'You have access to student management.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-5">
        <Button onClick={handleLogout} variant="destructive" className="w-full h-12" disabled={isLoggingOut}>
          {isLoggingOut ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
          {isLoggingOut ? 'Logging out...' : 'Logout'}
        </Button>
      </div>
    </div>
  );
};

export default AdminAccount;