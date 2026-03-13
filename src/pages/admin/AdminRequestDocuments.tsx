import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Archive, Search, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import { statusUtils } from '@/lib/status';
import { formatUtils } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';
import { smsService } from '@/lib/smsService';
import { notificationStorage } from '@/lib/notificationStorage';

interface RequestDisplay {
  id: string;
  dbId: string;
  userId: string;
  studentName: string;
  documents: string[];
  gradeLevel: string;
  section: string;
  requestDate: string;
  status: string;
  paymentMethod: string;
  amount: string;
  contactNumber: string;
}

const AdminRequestDocuments = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<RequestDisplay[]>([]);
  const [archivedRequests, setArchivedRequests] = useState<RequestDisplay[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('document_requests')
        .select('*, document_request_items(*)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching requests:', error);
        return;
      }

      const mapped: RequestDisplay[] = (data || []).map(req => {
        const items = req.document_request_items || [];
        const totalAmount = items.reduce((sum: number, item: any) => sum + Number(item.price), 0);
        return {
          id: `REQ-${String(req.request_number).padStart(3, '0')}`,
          dbId: req.id,
          userId: req.user_id,
          studentName: req.student_name,
          documents: items.map((item: any) => item.document_type),
          gradeLevel: req.grade_level,
          section: req.section,
          requestDate: req.created_at,
          status: req.status,
          paymentMethod: req.payment_method,
          amount: `₱${totalAmount.toLocaleString()}.00`,
          contactNumber: req.contact_number,
        };
      });

      setRequests(mapped.filter(r => r.status !== 'Completed'));
      setArchivedRequests(mapped.filter(r => r.status === 'Completed'));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('admin-request-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_requests' }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    const query = searchQuery.toLowerCase();
    return requests.filter((req) => req.studentName.toLowerCase().includes(query));
  }, [requests, searchQuery]);

  const filteredArchivedRequests = useMemo(() => {
    if (!searchQuery.trim()) return archivedRequests;
    const query = searchQuery.toLowerCase();
    return archivedRequests.filter((req) => req.studentName.toLowerCase().includes(query));
  }, [archivedRequests, searchQuery]);

  const activePagination = usePagination({ data: filteredRequests, itemsPerPage: 10 });
  const archivedPagination = usePagination({ data: filteredArchivedRequests, itemsPerPage: 10 });

  const handleStatusChange = async (request: RequestDisplay, newStatus: string) => {
    const { error } = await supabase
      .from('document_requests')
      .update({ status: newStatus })
      .eq('id', request.dbId);

    if (error) {
      console.error('Error updating status:', error);
      toast({ title: 'Error', description: 'Failed to update request status.', variant: 'destructive' });
      return;
    }

    // Auto-mark cash payments as paid when request is completed
    if (newStatus === 'Completed' && request.paymentMethod.toLowerCase() === 'cash') {
      const { error: payError } = await supabase
        .from('payments')
        .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
        .eq('request_id', request.dbId);
      if (payError) {
        console.error('Error updating payment status:', payError);
      }
    }

    // Create in-app notifications for both student and admin
    const statusLabel = newStatus === 'Ready' ? 'Ready for Pickup' : newStatus;

    notificationStorage.add({
      userId: request.userId,
      title: `Request ${statusLabel}`,
      message: `Your document request ${request.id} status has been updated to ${statusLabel}.`,
      type: 'status',
      requestId: request.id,
    });

    notificationStorage.add({
      userId: 'admin',
      title: `Request ${statusLabel}`,
      message: `${request.studentName}'s request ${request.id} has been updated to ${statusLabel}.`,
      type: 'status',
      requestId: request.id,
    });

    // Send SMS notification
    if (request.contactNumber) {
      await smsService.notifyStatusChange(request.contactNumber, request.studentName, request.id, newStatus);
    }

    await fetchRequests();

    toast({
      title: newStatus === 'Completed' ? 'Request Completed' : 'Status Updated',
      description: `Request ${request.id} status changed to ${newStatus}.`,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by student name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Document Requests
            <Badge variant="secondary">{filteredRequests.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No requests found matching your search.' : 'No active document requests.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead>Grade/Section</TableHead>
                      <TableHead>Request Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePagination.currentData.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.id}</TableCell>
                        <TableCell>{request.studentName}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {request.documents.map((doc, idx) => (
                              <div key={idx} className="text-sm">{doc}</div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {request.gradeLevel}<br />
                          <span className="text-sm text-muted-foreground">{request.section}</span>
                        </TableCell>
                        <TableCell>{formatUtils.formatDate(request.requestDate)}</TableCell>
                        <TableCell>
                          <Badge className={statusUtils.getRequestStatusColor(request.status)}>{request.status}</Badge>
                        </TableCell>
                        <TableCell>{request.paymentMethod}</TableCell>
                        <TableCell className="font-semibold">{request.amount}</TableCell>
                        <TableCell>
                          <Select value={request.status} onValueChange={(value) => handleStatusChange(request, value)}>
                            <SelectTrigger className="w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              <SelectItem value="Processing">Processing</SelectItem>
                              <SelectItem value="Approved">Approved</SelectItem>
                              <SelectItem value="Ready">Ready for Pickup</SelectItem>
                              <SelectItem value="Completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {activePagination.totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem><PaginationPrevious onClick={activePagination.goToPreviousPage} /></PaginationItem>
                      {[...Array(activePagination.totalPages)].map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink onClick={() => activePagination.goToPage(i + 1)} isActive={activePagination.currentPage === i + 1}>{i + 1}</PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem><PaginationNext onClick={activePagination.goToNextPage} /></PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="cursor-pointer" onClick={() => setShowArchive(!showArchive)}>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Archived Requests
              <Badge variant="secondary">{filteredArchivedRequests.length}</Badge>
            </div>
            <Button variant="ghost" size="sm">
              {showArchive ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
          </CardTitle>
        </CardHeader>
        {showArchive && (
          <CardContent>
            {filteredArchivedRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No archived requests found.' : 'No archived requests yet.'}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request ID</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Documents</TableHead>
                        <TableHead>Grade/Section</TableHead>
                        <TableHead>Request Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedPagination.currentData.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.id}</TableCell>
                          <TableCell>{request.studentName}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {request.documents.map((doc, idx) => (
                                <div key={idx} className="text-sm">{doc}</div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {request.gradeLevel}<br />
                            <span className="text-sm text-muted-foreground">{request.section}</span>
                          </TableCell>
                          <TableCell>{formatUtils.formatDate(request.requestDate)}</TableCell>
                          <TableCell>
                            <Badge className={statusUtils.getRequestStatusColor(request.status)}>{request.status}</Badge>
                          </TableCell>
                          <TableCell>{request.paymentMethod}</TableCell>
                          <TableCell className="font-semibold">{request.amount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {archivedPagination.totalPages > 1 && (
                  <div className="mt-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem><PaginationPrevious onClick={archivedPagination.goToPreviousPage} /></PaginationItem>
                        {[...Array(archivedPagination.totalPages)].map((_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink onClick={() => archivedPagination.goToPage(i + 1)} isActive={archivedPagination.currentPage === i + 1}>{i + 1}</PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem><PaginationNext onClick={archivedPagination.goToNextPage} /></PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default AdminRequestDocuments;
