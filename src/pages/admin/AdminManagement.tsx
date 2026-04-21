import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search, Plus, Edit2, Loader2, ShieldCheck, AlertTriangle,
  Archive, ArchiveRestore, ChevronDown, ChevronUp,
} from 'lucide-react';

interface AdminRow {
  id: string;
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  contact_number: string | null;
  is_archived: boolean | null;
  archived_at: string | null;
  created_at: string;
}

interface AdminFormData {
  username: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  contact_number: string;
  password: string;
}

const emptyForm: AdminFormData = {
  username: '',
  first_name: '',
  last_name: '',
  middle_name: '',
  contact_number: '',
  password: '',
};

const invokeWithAuth = async (fnName: string, body: object) => {
  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  let token = refreshed?.session?.access_token;
  if (refreshError || !token) {
    const { data: { session: existing } } = await supabase.auth.getSession();
    token = existing?.access_token;
  }
  if (!token) {
    await supabase.auth.signOut();
    window.location.href = '/';
    return { data: null, error: new Error('Session expired.') };
  }
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      return { data: null, error: new Error(data?.error || `Request failed with status ${response.status}`) };
    }
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: new Error(err.message || 'Network error') };
  }
};

const AdminManagement = () => {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminRow | null>(null);
  const [formData, setFormData] = useState<AdminFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<AdminRow | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [duplicateAlertOpen, setDuplicateAlertOpen] = useState(false);
  const [duplicateAlertMessage, setDuplicateAlertMessage] = useState('');

  const fetchAdmins = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admins')
      .select('id, user_id, username, first_name, last_name, middle_name, contact_number, is_archived, archived_at, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: 'Failed to load admins.', variant: 'destructive' });
    } else {
      setAdmins(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAdmins(); }, []);

  const activeAdmins = admins.filter(a => !a.is_archived);
  const archivedAdmins = admins.filter(a => a.is_archived);

  const filtered = activeAdmins.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.first_name.toLowerCase().includes(q) ||
      a.last_name.toLowerCase().includes(q) ||
      a.username.toLowerCase().includes(q)
    );
  });

  const filteredArchived = archivedAdmins.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.first_name.toLowerCase().includes(q) ||
      a.last_name.toLowerCase().includes(q) ||
      a.username.toLowerCase().includes(q)
    );
  });

  const checkDuplicate = (email: string): string | null => {
    const existing = activeAdmins.find(a => a.username.toLowerCase() === email.toLowerCase());
    if (existing) return `An admin with email "${email}" already exists (${existing.first_name} ${existing.last_name}).`;
    return null;
  };

  const handleAddAdmin = async () => {
    if (!formData.username || !formData.first_name || !formData.last_name || !formData.password) {
      toast({ title: 'Missing fields', description: 'Email, first name, last name, and password are required.', variant: 'destructive' });
      return;
    }
    if (formData.password.length < 6) {
      toast({ title: 'Weak password', description: 'Password must be at least 6 characters.', variant: 'destructive' });
      return;
    }
    const dupMessage = checkDuplicate(formData.username);
    if (dupMessage) {
      setDuplicateAlertMessage(dupMessage);
      setDuplicateAlertOpen(true);
      return;
    }
    setSaving(true);
    const { error } = await invokeWithAuth('create-admin', {
      email: formData.username,
      password: formData.password,
      first_name: formData.first_name,
      last_name: formData.last_name,
      middle_name: formData.middle_name || null,
      contact_number: formData.contact_number || null,
    });
    if (error) {
      const errMsg = error.message || 'Failed to create admin.';
      if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('exists')) {
        setDuplicateAlertMessage(`This admin already exists. ${errMsg}`);
        setDuplicateAlertOpen(true);
      } else {
        toast({ title: 'Error', description: errMsg, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Admin Created', description: `${formData.first_name} ${formData.last_name} has been added as admin.` });
      setFormOpen(false);
      setFormData(emptyForm);
      await fetchAdmins();
    }
    setSaving(false);
  };

  const handleEditAdmin = async () => {
    if (!editingAdmin) return;
    setSaving(true);
    const { error } = await supabase
      .from('admins')
      .update({
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_name: formData.middle_name || null,
        contact_number: formData.contact_number || null,
      })
      .eq('id', editingAdmin.id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to update admin.', variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: 'Admin profile has been updated.' });
      setFormOpen(false);
      setEditingAdmin(null);
      setFormData(emptyForm);
      await fetchAdmins();
    }
    setSaving(false);
  };

  const handleArchiveAdmin = async (action: 'archive' | 'unarchive') => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const { error } = await invokeWithAuth('archive-account', {
        user_id: archiveTarget.user_id,
        account_type: 'admin',
        action,
      });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({
          title: action === 'archive' ? 'Archived' : 'Restored',
          description: `${archiveTarget.first_name} ${archiveTarget.last_name} has been ${action === 'archive' ? 'archived' : 'restored'}.`,
        });
        await fetchAdmins();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setArchiveTarget(null);
    setArchiving(false);
  };

  const openEdit = (a: AdminRow) => {
    setEditingAdmin(a);
    setFormData({
      username: a.username,
      first_name: a.first_name,
      last_name: a.last_name,
      middle_name: a.middle_name || '',
      contact_number: a.contact_number || '',
      password: '',
    });
    setFormOpen(true);
  };

  const AdminTable = ({ data, isArchived = false }: { data: AdminRow[], isArchived?: boolean }) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Contact</TableHead>
            {isArchived && <TableHead>Archived On</TableHead>}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((a) => (
            <TableRow key={a.id} className={isArchived ? 'opacity-60' : ''}>
              <TableCell className="font-medium">
                {a.first_name} {a.middle_name ? a.middle_name + ' ' : ''}{a.last_name}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{a.username}</TableCell>
              <TableCell className="text-sm">{a.contact_number || '—'}</TableCell>
              {isArchived && (
                <TableCell className="text-sm text-muted-foreground">
                  {a.archived_at ? new Date(a.archived_at).toLocaleDateString() : '—'}
                </TableCell>
              )}
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {!isArchived && (
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={isArchived ? 'text-green-600 hover:text-green-700' : 'text-amber-500 hover:text-amber-600'}
                    onClick={() => setArchiveTarget({ ...a, is_archived: isArchived })}
                    title={isArchived ? 'Restore' : 'Archive'}
                  >
                    {isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">Admin Management</h1>
        </div>
        <Button onClick={() => { setEditingAdmin(null); setFormData(emptyForm); setFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Admin
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Active Admins */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-lg">Admins ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {search ? 'No admins match your search.' : 'No admins found.'}
            </div>
          ) : (
            <AdminTable data={filtered} />
          )}
        </CardContent>
      </Card>

      {/* Archived Admins */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="cursor-pointer bg-muted/30" onClick={() => setShowArchived(!showArchived)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <Archive className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Archived Admins</CardTitle>
                <p className="text-sm text-muted-foreground">Archived accounts are hidden from active lists</p>
              </div>
              <Badge variant="secondary">{archivedAdmins.length}</Badge>
            </div>
            <Button variant="ghost" size="sm">
              {showArchived ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
          </div>
        </CardHeader>
        {showArchived && (
          <CardContent className="p-0">
            {filteredArchived.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No archived admins.</div>
            ) : (
              <AdminTable data={filteredArchived} isArchived />
            )}
          </CardContent>
        )}
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); setEditingAdmin(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAdmin ? 'Edit Admin' : 'Add New Admin'}</DialogTitle>
            <DialogDescription>
              {editingAdmin ? 'Update the admin profile information below.' : 'Fill in the details to create a new admin account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {!editingAdmin && (
              <>
                <div className="col-span-2 space-y-2">
                  <Label>Email *</Label>
                  <Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="admin@email.com" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Password *</Label>
                  <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Minimum 6 characters" />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value.replace(/[^a-zA-Z\s]/g, '') })} />
            </div>
            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value.replace(/[^a-zA-Z\s]/g, '') })} />
            </div>
            <div className="space-y-2">
              <Label>Middle Name</Label>
              <Input value={formData.middle_name} onChange={(e) => setFormData({ ...formData, middle_name: e.target.value.replace(/[^a-zA-Z\s]/g, '') })} />
            </div>
            <div className="space-y-2">
              <Label>Contact Number</Label>
              <Input value={formData.contact_number} onChange={(e) => setFormData({ ...formData, contact_number: e.target.value.replace(/[^0-9]/g, '') })} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={editingAdmin ? handleEditAdmin : handleAddAdmin} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingAdmin ? 'Save Changes' : 'Create Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveTarget?.is_archived ? 'Restore Admin' : 'Archive Admin'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.is_archived
                ? `Restore ${archiveTarget?.first_name} ${archiveTarget?.last_name}? They will appear in the active admins list again.`
                : `Archive ${archiveTarget?.first_name} ${archiveTarget?.last_name}? They will be hidden from active list but data will be kept.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleArchiveAdmin(archiveTarget?.is_archived ? 'unarchive' : 'archive')}
              disabled={archiving}
              className={archiveTarget?.is_archived ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-500 hover:bg-amber-600'}
            >
              {archiving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {archiveTarget?.is_archived ? 'Restore' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Alert */}
      <AlertDialog open={duplicateAlertOpen} onOpenChange={setDuplicateAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Duplicate Admin Found
            </AlertDialogTitle>
            <AlertDialogDescription>{duplicateAlertMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDuplicateAlertOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminManagement;