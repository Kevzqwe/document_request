import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { History, Eye, Archive, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import TrackingStepper from '@/components/TrackingStepper';
import { trackingUtils } from '@/lib/tracking';
import { supabase } from '@/integrations/supabase/client';
import { DOCUMENT_TYPES } from '@/lib/documents';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface RequestDisplay {
  id: string;
  requestNumber: number;
  studentName: string;
  documents: string[];
  requestDate: string;
  status: string;
  paymentMethod: string;
  amount: string;
  gradeLevel: string;
  section: string;
  contactNumber: string;
  claimDate: string;
  referenceNumber?: string | null;
  paidAt?: string | null;
}

const RequestHistory = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');
  const [activeRequests, setActiveRequests] = useState<RequestDisplay[]>([]);
  const [archivedRequests, setArchivedRequests] = useState<RequestDisplay[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RequestDisplay | null>(null);
  const [notifyOnDelivery, setNotifyOnDelivery] = useState(false);
  const [showArchive, setShowArchive] = useState(filterParam === 'completed');
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    if (!user?.id) return;
    
    try {
      // Fetch requests with items
      const { data: requests, error } = await supabase
        .from('document_requests')
        .select('*, document_request_items(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching requests:', error);
        return;
      }

      // Fetch payments for these requests
      const requestIds = (requests || []).map(r => r.id);
      let paymentsMap: Record<string, any> = {};
      if (requestIds.length > 0) {
        const { data: payments } = await supabase
          .from('payments')
          .select('*')
          .in('request_id', requestIds);
        if (payments) {
          paymentsMap = Object.fromEntries(payments.map(p => [p.request_id, p]));
        }
      }

      const mapped: RequestDisplay[] = (requests || []).map(req => {
        const items = req.document_request_items || [];
        const payment = paymentsMap[req.id];
        const totalAmount = items.reduce((sum: number, item: any) => sum + Number(item.price), 0);
        const formattedId = `REQ-${String(req.request_number).padStart(3, '0')}`;

        return {
          id: formattedId,
          requestNumber: req.request_number,
          studentName: req.student_name,
          documents: items.map((item: any) => item.document_type),
          requestDate: req.created_at,
          status: req.status,
          paymentMethod: req.payment_method,
          amount: `₱${totalAmount.toLocaleString()}.00`,
          gradeLevel: req.grade_level,
          section: req.section,
          contactNumber: req.contact_number,
          claimDate: req.status === 'Completed' ? req.updated_at.split('T')[0] : 'TBA',
          referenceNumber: payment?.reference_number || null,
          paidAt: payment?.paid_at || null,
        };
      });

      setActiveRequests(mapped.filter(r => r.status !== 'Completed'));
      setArchivedRequests(mapped.filter(r => r.status === 'Completed'));
    } catch (err) {
      console.error('Error loading requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('request-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_requests' }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Apply filter from query params
  const filteredActiveRequests = filterParam === 'approved'
    ? activeRequests.filter(r => r.status === 'Approved' || r.status === 'Ready')
    : filterParam === 'pending'
    ? activeRequests.filter(r => r.status === 'Processing' || r.status === 'pending')
    : activeRequests;

  const activePagination = usePagination({ data: filteredActiveRequests, itemsPerPage: 3 });
  const archivedPagination = usePagination({ data: archivedRequests, itemsPerPage: 3 });

  const clearFilter = () => {
    setSearchParams({});
  };

  const handleViewDetails = (request: RequestDisplay) => {
    setSelectedRequest(request);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasAnyRequests = activeRequests.length > 0 || archivedRequests.length > 0;

  if (!hasAnyRequests) {
    return (
      <div className="space-y-6">
        <Card className="border-2 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 border-b">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <History className="w-6 h-6 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl">Request History & Tracking</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No document requests yet.</p>
              <p className="text-sm mt-2">Submit a document request to see it here.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 border-b">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <History className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Request History & Tracking</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {filterParam && filterParam !== 'completed' && (
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-sm">
                Showing: {filterParam === 'approved' ? 'Approved' : filterParam === 'pending' ? 'Pending' : 'All Requests'}
              </Badge>
              <Button variant="ghost" size="sm" onClick={clearFilter} className="text-xs h-7">
                Clear filter
              </Button>
            </div>
          )}
          {filteredActiveRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active requests. All completed requests are in the archive.
            </div>
          ) : (
            <>
              {activePagination.currentData.map((request) => (
                <Card key={request.id} className="border-2 overflow-hidden">
                  <div className="bg-foreground text-background px-4 py-3 text-center">
                    <h3 className="font-semibold text-lg">
                      TRACKING ORDER NO - {request.id}
                    </h3>
                  </div>
                  <div className="flex flex-wrap justify-between items-center px-4 py-3 bg-muted/50 border-b text-sm gap-2">
                    <span>
                      <span className="text-muted-foreground">Document:</span>{' '}
                      <span className="font-medium">{request.documents.join(', ')}</span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">Status:</span>{' '}
                      <span className="font-medium">{request.status}</span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">Expected Date:</span>{' '}
                      <span className="font-medium">
                        {request.claimDate !== 'TBA'
                          ? request.claimDate
                          : trackingUtils.getExpectedDate(request.requestDate, request.status)}
                      </span>
                    </span>
                  </div>
                  <div className="px-4 md:px-8 py-6">
                    <TrackingStepper status={request.status} />
                  </div>
                  <div className="flex flex-wrap justify-between items-center px-4 py-3 border-t gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`notify-${request.id}`}
                        checked={notifyOnDelivery}
                        onCheckedChange={(checked) => setNotifyOnDelivery(!!checked)}
                      />
                      <Label
                        htmlFor={`notify-${request.id}`}
                        className="text-sm text-muted-foreground cursor-pointer"
                      >
                        Notify me when order is ready
                      </Label>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(request)}
                      className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Order Details
                    </Button>
                  </div>
                </Card>
              ))}

              {activePagination.totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious onClick={activePagination.goToPreviousPage} />
                      </PaginationItem>
                      {[...Array(activePagination.totalPages)].map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink
                            onClick={() => activePagination.goToPage(i + 1)}
                            isActive={activePagination.currentPage === i + 1}
                          >
                            {i + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext onClick={activePagination.goToNextPage} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Archived Requests */}
      <Card className="border-2 shadow-lg">
        <CardHeader
          className="cursor-pointer bg-muted/30"
          onClick={() => setShowArchive(!showArchive)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <Archive className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Archived Requests</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Completed requests are stored here
                </p>
              </div>
              <Badge variant="secondary">{archivedRequests.length}</Badge>
            </div>
            <Button variant="ghost" size="sm">
              {showArchive ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
          </div>
        </CardHeader>
        {showArchive && (
          <CardContent className="pt-6 space-y-6">
            {archivedRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No archived requests yet.</div>
            ) : (
              <>
                {archivedPagination.currentData.map((request) => (
                  <Card key={request.id} className="border-2 overflow-hidden opacity-80">
                    <div className="bg-foreground/80 text-background px-4 py-3 text-center">
                      <h3 className="font-semibold text-lg">COMPLETED ORDER - {request.id}</h3>
                    </div>
                    <div className="flex flex-wrap justify-between items-center px-4 py-3 bg-muted/50 border-b text-sm gap-2">
                      <span>
                        <span className="text-muted-foreground">Document:</span>{' '}
                        <span className="font-medium">{request.documents.join(', ')}</span>
                      </span>
                      <span>
                        <span className="text-muted-foreground">Status:</span>{' '}
                        <span className="font-medium text-primary">{request.status}</span>
                      </span>
                      <span>
                        <span className="text-muted-foreground">Claim Date:</span>{' '}
                        <span className="font-medium">{request.claimDate}</span>
                      </span>
                    </div>
                    <div className="flex justify-end items-center px-4 py-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(request)}
                        className="border-muted-foreground/50"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </Card>
                ))}

                {archivedPagination.totalPages > 1 && (
                  <div className="mt-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious onClick={archivedPagination.goToPreviousPage} />
                        </PaginationItem>
                        {[...Array(archivedPagination.totalPages)].map((_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink
                              onClick={() => archivedPagination.goToPage(i + 1)}
                              isActive={archivedPagination.currentPage === i + 1}
                            >
                              {i + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext onClick={archivedPagination.goToNextPage} />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>

      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 p-4 bg-primary/10 rounded-lg border-2 border-primary/30">
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Need Help?</h3>
              <p className="text-sm text-muted-foreground">
                For questions about your requests, contact the Registrar's Office at
                registrar@school.edu.ph or call (02) 1234-5678
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Order Details - {selectedRequest?.id}</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Document(s):</span>
                  <p className="font-medium">{selectedRequest.documents.join(', ')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p className="font-medium">{selectedRequest.status}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Request Date:</span>
                  <p className="font-medium">{new Date(selectedRequest.requestDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Claim Date:</span>
                  <p className="font-medium">{selectedRequest.claimDate}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Method:</span>
                  <p className="font-medium">{selectedRequest.paymentMethod}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount:</span>
                  <p className="font-medium">{selectedRequest.amount}</p>
                </div>
              </div>
              <Button onClick={() => setSelectedRequest(null)} className="w-full">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestHistory;
