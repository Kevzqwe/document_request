import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Search, CreditCard, Loader2 } from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Payment {
  payment_id: string;
  request_id: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  reference_number: string | null;
  paid_at: string | null;
  created_at: string;
  request_number: number;
  student_name: string;
  contact_number: string;
  grade_level: string;
  section: string;
  request_status: string;
  documents: { document_type: string; price: number }[];
}

const AdminPayments = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const isCashier = profile?.role === 'cashier';

  const [payments, setPayments]       = useState<Payment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId]   = useState<string | null>(null);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*, document_requests(request_number, student_name, contact_number, grade_level, section, status, document_request_items(document_type, price))')
        .order('created_at', { ascending: false });

      if (error) { console.error('Error fetching payments:', error); return; }

      const mapped: Payment[] = (data || []).map((p: any) => ({
        payment_id:     p.id,
        request_id:     p.request_id,
        amount:         p.amount,
        payment_method: p.payment_method,
        payment_status: p.payment_status,
        reference_number: p.reference_number,
        paid_at:        p.paid_at,
        created_at:     p.created_at,
        request_number: p.document_requests?.request_number || 0,
        student_name:   p.document_requests?.student_name   || '—',
        contact_number: p.document_requests?.contact_number || '—',
        grade_level:    p.document_requests?.grade_level    || '—',
        section:        p.document_requests?.section        || '—',
        request_status: p.document_requests?.status         || '—',
        documents:      p.document_requests?.document_request_items || [],
      }));

      setPayments(mapped);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, []);

  // ── Cashier: update cash payment status ──────────────────────────────────
  const handlePaymentStatusChange = async (payment: Payment, newStatus: string) => {
    setUpdatingId(payment.payment_id);
    try {
      const updateData: Record<string, any> = { payment_status: newStatus };

      if (newStatus === 'paid') {
        updateData.paid_at = new Date().toISOString();
      } else {
        updateData.paid_at = null;
      }

      const { error } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', payment.payment_id);

      if (error) {
        toast({ title: 'Error', description: 'Failed to update payment status.', variant: 'destructive' });
        return;
      }

      toast({
        title: 'Payment Updated',
        description: `Payment marked as ${newStatus} for ${payment.student_name}.`,
      });

      await fetchPayments();
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = payments.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.student_name.toLowerCase().includes(q) ||
      (p.reference_number || '').toLowerCase().includes(q) ||
      p.payment_method.toLowerCase().includes(q) ||
      p.payment_status.toLowerCase().includes(q)
    );
  });

  const { currentData, currentPage, totalPages, goToPage } = usePagination({ data: filtered, itemsPerPage: 10 });

  const statusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':    return 'default';
      case 'pending': return 'secondary';
      case 'failed':  return 'destructive';
      default:        return 'outline';
    }
  };

  const formatReqId = (num?: number) => num ? `REQ-${String(num).padStart(3, '0')}` : '—';

  // ── Determine if cashier can change the payment status ────────────────────
  // Only cash payments that are pending OR paid can be toggled by cashier
  // Locked = online payments (handled by payment gateway)
  const canCashierEdit = (p: Payment) =>
    isCashier && p.payment_method.toLowerCase() === 'cash';

  // Locked if: online payment OR request is not in a state where payment makes sense
  const isLocked = (p: Payment) =>
    !canCashierEdit(p);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Payments</h1>
        <p className="text-muted-foreground mt-1">View all payment records</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Records
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search payments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No payments found.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Grade & Section</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Request Status</TableHead>
                    <TableHead>Reference #</TableHead>
                    <TableHead>Paid At</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.map((p) => (
                    <TableRow key={p.payment_id}>
                      <TableCell className="font-mono text-sm">{formatReqId(p.request_number)}</TableCell>
                      <TableCell className="font-medium">{p.student_name}</TableCell>
                      <TableCell className="text-sm">{p.contact_number}</TableCell>
                      <TableCell className="text-sm">{`${p.grade_level} - ${p.section}`}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.documents.length > 0
                            ? p.documents.map((d, i) => (
                                <Badge key={i} variant="outline" className="text-xs whitespace-nowrap">
                                  {d.document_type}
                                </Badge>
                              ))
                            : '—'}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">₱{Number(p.amount).toFixed(2)}</TableCell>
                      <TableCell className="capitalize">{p.payment_method}</TableCell>

                      {/* ── Payment Status ── */}
                      <TableCell>
                        {canCashierEdit(p) ? (
                          // Cashier can toggle cash payment status
                          <div className="flex items-center gap-2">
                            {updatingId === p.payment_id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            ) : (
                              <Select
                                value={p.payment_status}
                                onValueChange={(val) => handlePaymentStatusChange(p, val)}
                              >
                                <SelectTrigger className="w-[110px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="paid">Paid</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        ) : (
                          // Admin sees badge, online payments are read-only
                          <Badge
                            variant={statusVariant(p.payment_status)}
                            className="capitalize"
                          >
                            {p.payment_status}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="capitalize">{p.request_status}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.reference_number || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {p.paid_at ? format(new Date(p.paid_at), 'MMM d, yyyy h:mm a') : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(p.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} ({filtered.length} records)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPayments;