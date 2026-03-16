import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
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
  Search, Upload, Plus, Edit2, Trash2, Loader2, Users, FileSpreadsheet, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface StudentRow {
  id: string;
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  contact_number: string | null;
  grade_level: string | null;
  section: string | null;
  student_id: string | null;
  created_at: string;
}

interface StudentFormData {
  username: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  contact_number: string;
  grade_level: string;
  section: string;
  student_id: string;
  password: string;
}

const emptyForm: StudentFormData = {
  username: '',
  first_name: '',
  last_name: '',
  middle_name: '',
  contact_number: '',
  grade_level: '',
  section: '',
  student_id: '',
  password: '',
};

// ✅ Helper: invoke edge function using direct fetch with a force-refreshed token
const invokeWithAuth = async (fnName: string, body: object) => {
  // ✅ Always force-refresh to guarantee a valid token on any device
  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

  let token = refreshed?.session?.access_token;

  // If refresh fails, fall back to existing session
  if (refreshError || !token) {
    const { data: { session: existing } } = await supabase.auth.getSession();
    token = existing?.access_token;
  }

  // If still no token, user is not logged in — redirect to login
  if (!token) {
    await supabase.auth.signOut();
    window.location.href = '/';
    return { data: null, error: new Error('Session expired. Please log in again.') };
  }

  // ✅ Use direct fetch instead of supabase.functions.invoke
  // This guarantees the Authorization header is sent correctly
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

const AdminStudentManagement = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [formData, setFormData] = useState<StudentFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<StudentFormData[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [invalidFormatOpen, setInvalidFormatOpen] = useState(false);
  const [invalidFormatMessage, setInvalidFormatMessage] = useState('');
  const [duplicateAlertOpen, setDuplicateAlertOpen] = useState(false);
  const [duplicateAlertMessage, setDuplicateAlertMessage] = useState('');
  const [importDuplicates, setImportDuplicates] = useState<string[]>([]);

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('id, user_id, username, first_name, last_name, middle_name, contact_number, grade_level, section, student_id, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'Failed to load students.', variant: 'destructive' });
    } else {
      setStudents(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, []);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q) ||
      s.username.toLowerCase().includes(q) ||
      (s.student_id || '').toLowerCase().includes(q) ||
      (s.grade_level || '').toLowerCase().includes(q) ||
      (s.section || '').toLowerCase().includes(q)
    );
  });

  const checkDuplicate = (email: string, studentId?: string | null): string | null => {
    const existingByEmail = students.find(s => s.username.toLowerCase() === email.toLowerCase());
    if (existingByEmail) {
      return `A student with email "${email}" already exists (${existingByEmail.first_name} ${existingByEmail.last_name}).`;
    }
    if (studentId) {
      const existingById = students.find(s => s.student_id && s.student_id.toLowerCase() === studentId.toLowerCase());
      if (existingById) {
        return `A student with ID "${studentId}" already exists (${existingById.first_name} ${existingById.last_name}).`;
      }
    }
    return null;
  };

  // ── Add new student ──
  const handleAddStudent = async () => {
    if (!formData.username || !formData.first_name || !formData.last_name || !formData.password) {
      toast({ title: 'Missing fields', description: 'Email, first name, last name, and password are required.', variant: 'destructive' });
      return;
    }

    if (formData.password.length < 6) {
      toast({ title: 'Weak password', description: 'Password must be at least 6 characters.', variant: 'destructive' });
      return;
    }

    const dupMessage = checkDuplicate(formData.username, formData.student_id || null);
    if (dupMessage) {
      setDuplicateAlertMessage(dupMessage);
      setDuplicateAlertOpen(true);
      return;
    }

    setSaving(true);

    // ✅ Use invokeWithAuth instead of supabase.functions.invoke directly
    const { error } = await invokeWithAuth('create-student', {
      email: formData.username,
      password: formData.password,
      first_name: formData.first_name,
      last_name: formData.last_name,
      middle_name: formData.middle_name || null,
      contact_number: formData.contact_number || null,
      grade_level: formData.grade_level || null,
      section: formData.section || null,
      student_id: formData.student_id || null,
    });

    if (error) {
      const errMsg = error.message || 'Failed to create student.';
      if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('duplicate') || errMsg.toLowerCase().includes('exists')) {
        setDuplicateAlertMessage(`This student already exists in the database. ${errMsg}`);
        setDuplicateAlertOpen(true);
      } else {
        toast({ title: 'Error', description: errMsg, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Student Created', description: `${formData.first_name} ${formData.last_name} has been added.` });
      setFormOpen(false);
      setFormData(emptyForm);
      await fetchStudents();
    }
    setSaving(false);
  };

  // ── Edit existing student ──
  const handleEditStudent = async () => {
    if (!editingStudent) return;
    setSaving(true);

    const { error } = await supabase
      .from('students')
      .update({
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_name: formData.middle_name || null,
        contact_number: formData.contact_number || null,
        grade_level: formData.grade_level || null,
        section: formData.section || null,
        student_id: formData.student_id || null,
      })
      .eq('id', editingStudent.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update student.', variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: 'Student profile has been updated.' });
      setFormOpen(false);
      setEditingStudent(null);
      setFormData(emptyForm);
      await fetchStudents();
    }
    setSaving(false);
  };

  // ── Delete student ──
  const handleDeleteStudent = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast({ title: 'Error', description: error.message || 'Failed to delete student.', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: `${deleteTarget.first_name} ${deleteTarget.last_name} removed.` });
      await fetchStudents();
    }
    setDeleteTarget(null);
    setDeleting(false);
  };

  const openEdit = (s: StudentRow) => {
    setEditingStudent(s);
    setFormData({
      username: s.username,
      first_name: s.first_name,
      last_name: s.last_name,
      middle_name: s.middle_name || '',
      contact_number: s.contact_number || '',
      grade_level: s.grade_level || '',
      section: s.section || '',
      student_id: s.student_id || '',
      password: '',
    });
    setFormOpen(true);
  };

  const openAdd = () => {
    setEditingStudent(null);
    setFormData(emptyForm);
    setFormOpen(true);
  };

  const ACCEPTED_HEADER_VARIANTS: Record<string, string[]> = {
    email: ['email', 'Email', 'username', 'Username'],
    first_name: ['first_name', 'First Name', 'FirstName'],
    last_name: ['last_name', 'Last Name', 'LastName'],
  };

  const validateExcelHeaders = (headers: string[]): { valid: boolean; missing: string[] } => {
    const trimmedHeaders = headers.map(h => h.trim());
    const missing: string[] = [];
    for (const [key, variants] of Object.entries(ACCEPTED_HEADER_VARIANTS)) {
      const found = variants.some(v => trimmedHeaders.includes(v));
      if (!found) missing.push(key.replace('_', ' '));
    }
    return { valid: missing.length === 0, missing };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rows.length === 0) {
          setInvalidFormatMessage('The file is empty. Please upload a file with student data.');
          setInvalidFormatOpen(true);
          return;
        }

        const headers = Object.keys(rows[0]);
        const { valid, missing } = validateExcelHeaders(headers);
        if (!valid) {
          setInvalidFormatMessage(
            `Invalid Excel format. The following required columns are missing:\n• ${missing.join('\n• ')}\n\nExpected columns: Email, First Name, Last Name, Middle Name, Student ID, Grade Level, Section, Contact Number, Password`
          );
          setInvalidFormatOpen(true);
          return;
        }

        const mapped: StudentFormData[] = rows.map((r) => ({
          username: r['email'] || r['Email'] || r['username'] || r['Username'] || '',
          first_name: r['first_name'] || r['First Name'] || r['FirstName'] || '',
          last_name: r['last_name'] || r['Last Name'] || r['LastName'] || '',
          middle_name: r['middle_name'] || r['Middle Name'] || r['MiddleName'] || '',
          contact_number: r['contact_number'] || r['Contact Number'] || r['ContactNumber'] || r['Phone'] || '',
          grade_level: r['grade_level'] || r['Grade Level'] || r['GradeLevel'] || r['Grade'] || '',
          section: r['section'] || r['Section'] || '',
          student_id: r['student_id'] || r['Student ID'] || r['StudentID'] || r['ID'] || '',
          password: r['password'] || r['Password'] || 'changeme123',
        }));

        const duplicates: string[] = [];
        const uniqueRows: StudentFormData[] = [];
        const seenEmails = new Set<string>();

        for (const row of mapped) {
          if (!row.username || !row.first_name || !row.last_name) continue;
          const email = row.username.toLowerCase();
          if (seenEmails.has(email)) {
            duplicates.push(`Duplicate in file: ${row.username}`);
            continue;
          }
          seenEmails.add(email);
          const dupMsg = checkDuplicate(row.username, row.student_id || null);
          if (dupMsg) {
            duplicates.push(dupMsg);
          } else {
            uniqueRows.push(row);
          }
        }

        setImportDuplicates(duplicates);
        setImportPreview(uniqueRows);
        setImportDialogOpen(true);
      } catch {
        setInvalidFormatMessage('Could not parse the file. Please make sure it is a valid Excel (.xlsx, .xls) or CSV file.');
        setInvalidFormatOpen(true);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    setImporting(true);
    let success = 0;
    let failed = 0;

    for (const row of importPreview) {
      if (!row.username || !row.first_name || !row.last_name) {
        failed++;
        continue;
      }

      // ✅ Use invokeWithAuth for import too
      const { error } = await invokeWithAuth('create-student', {
        email: row.username,
        password: row.password || 'changeme123',
        first_name: row.first_name,
        last_name: row.last_name,
        middle_name: row.middle_name || null,
        contact_number: row.contact_number || null,
        grade_level: row.grade_level || null,
        section: row.section || null,
        student_id: row.student_id || null,
      });

      if (error) failed++;
      else success++;
    }

    toast({
      title: 'Import Complete',
      description: `${success} students imported successfully${failed > 0 ? `, ${failed} failed` : ''}.`,
      variant: failed > 0 && success === 0 ? 'destructive' : 'default',
    });

    setImportDialogOpen(false);
    setImportPreview([]);
    setImportDuplicates([]);
    await fetchStudents();
    setImporting(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">Student Management</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Import Excel
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, ID, grade, section..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-lg">Students ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {search ? 'No students match your search.' : 'No students found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Grade & Section</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.student_id || '—'}</TableCell>
                      <TableCell className="font-medium">
                        {s.first_name} {s.middle_name ? s.middle_name + ' ' : ''}{s.last_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.username}</TableCell>
                      <TableCell className="text-sm">
                        {s.grade_level || '—'} {s.section ? `/ ${s.section}` : ''}
                      </TableCell>
                      <TableCell className="text-sm">{s.contact_number || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(s)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); setEditingStudent(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingStudent ? 'Edit Student' : 'Add New Student'}</DialogTitle>
            {/* ✅ fixes the aria-describedby warning */}
            <DialogDescription>
              {editingStudent ? 'Update the student profile information below.' : 'Fill in the details to create a new student account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {!editingStudent && (
              <>
                <div className="col-span-2 space-y-2">
                  <Label>Email *</Label>
                  <Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="student@email.com" />
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
              <Label>Student ID</Label>
              <Input value={formData.student_id} onChange={(e) => setFormData({ ...formData, student_id: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Grade Level</Label>
              <Input value={formData.grade_level} onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Section</Label>
              <Input value={formData.section} onChange={(e) => setFormData({ ...formData, section: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Contact Number</Label>
              <Input value={formData.contact_number} onChange={(e) => setFormData({ ...formData, contact_number: e.target.value.replace(/[^0-9]/g, '') })} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={editingStudent ? handleEditStudent : handleAddStudent} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingStudent ? 'Save Changes' : 'Create Student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.first_name} {deleteTarget?.last_name}? This will remove their profile data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStudent} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invalid Format Modal */}
      <AlertDialog open={invalidFormatOpen} onOpenChange={setInvalidFormatOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Invalid Excel Format
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {invalidFormatMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setInvalidFormatOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Student Alert */}
      <AlertDialog open={duplicateAlertOpen} onOpenChange={setDuplicateAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Duplicate Student Found
            </AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateAlertMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDuplicateAlertOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!open && !importing) { setImportDialogOpen(false); setImportPreview([]); setImportDuplicates([]); } }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Import Preview — {importPreview.length} students
            </DialogTitle>
            {/* ✅ fixes the aria-describedby warning for this dialog too */}
            <DialogDescription>
              Review the students below before confirming the import.
            </DialogDescription>
          </DialogHeader>

          {importDuplicates.length > 0 && (
            <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
                <AlertTriangle className="w-4 h-4" />
                {importDuplicates.length} duplicate(s) found and will be skipped:
              </div>
              <ul className="text-sm text-amber-600 dark:text-amber-400 space-y-1 max-h-24 overflow-auto">
                {importDuplicates.map((d, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span className="text-amber-500">•</span> {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {importPreview.length > 0 ? (
            <>
              <div className="overflow-auto max-h-[50vh] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Section</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.map((r, i) => (
                      <TableRow key={i} className={!r.username || !r.first_name || !r.last_name ? 'bg-destructive/10' : ''}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="text-sm">{r.username || <span className="text-destructive">Missing</span>}</TableCell>
                        <TableCell className="text-sm">{r.first_name} {r.last_name}</TableCell>
                        <TableCell className="text-sm">{r.student_id || '—'}</TableCell>
                        <TableCell className="text-sm">{r.grade_level || '—'}</TableCell>
                        <TableCell className="text-sm">{r.section || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-muted-foreground">
                Rows highlighted in red are missing required fields and will be skipped.
                Default password: <code className="bg-muted px-1 rounded">changeme123</code>
              </p>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              All students in this file already exist in the database. Nothing to import.
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportPreview([]); setImportDuplicates([]); }} disabled={importing}>
              Cancel
            </Button>
            {importPreview.length > 0 && (
              <Button onClick={handleImportConfirm} disabled={importing}>
                {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {importing ? 'Importing...' : `Import ${importPreview.length} Students`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminStudentManagement;