import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MessageSquare, Eye, RefreshCw, Loader2 } from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import { statusUtils } from '@/lib/status';
import { formatUtils } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';

interface Feedback {
  id: string;
  studentName: string;
  email: string;
  messageType: string;
  message: string;
  date: string;
  status: string;
  dbStatus: string;
}

const AdminMessages = () => {
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeedbacks = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching feedback:', error);
        return;
      }

      // Get student names from students table
      const userIds = [...new Set((data || []).map(f => f.user_id))];
      let studentsMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: students } = await supabase
          .from('students')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);
        if (students) {
          studentsMap = Object.fromEntries(
            students.map(s => [s.user_id, `${s.first_name} ${s.last_name}`.trim()])
          );
        }
      }

      const mapped: Feedback[] = (data || []).map(f => ({
        id: f.id,
        studentName: studentsMap[f.user_id] || 'Unknown',
        email: f.email,
        messageType: f.message_type.charAt(0).toUpperCase() + f.message_type.slice(1),
        message: f.message,
        date: f.created_at,
        status: f.status === 'unread' ? 'New' : f.status === 'read' ? 'Read' : 'Resolved',
        dbStatus: f.status,
      }));

      setFeedbacks(mapped);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedbacks();
  }, []);

  const {
    currentPage,
    totalPages,
    currentData,
    goToNextPage,
    goToPreviousPage,
    goToPage,
  } = usePagination({ data: feedbacks, itemsPerPage: 10 });

  const handleViewMessage = async (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setViewDialogOpen(true);
    
    if (feedback.dbStatus === 'unread') {
      await supabase
        .from('feedback')
        .update({ status: 'read' })
        .eq('id', feedback.id);
      loadFeedbacks();
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Student Feedback & Messages
              <Badge variant="secondary">{feedbacks.length}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={loadFeedbacks}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Message Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentData.map((feedback) => (
                      <TableRow key={feedback.id}>
                        <TableCell>{feedback.studentName}</TableCell>
                        <TableCell>{feedback.email}</TableCell>
                        <TableCell>
                          <Badge className={statusUtils.getMessageTypeColor(feedback.messageType)}>
                            {feedback.messageType}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatUtils.formatDate(feedback.date)}</TableCell>
                        <TableCell>
                          <Badge className={statusUtils.getMessageStatusColor(feedback.status)}>
                            {feedback.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => handleViewMessage(feedback)}>
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem><PaginationPrevious onClick={goToPreviousPage} /></PaginationItem>
                      {[...Array(totalPages)].map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink onClick={() => goToPage(i + 1)} isActive={currentPage === i + 1}>{i + 1}</PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem><PaginationNext onClick={goToNextPage} /></PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Message Details</DialogTitle>
          </DialogHeader>
          {selectedFeedback && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Student Name</p>
                  <p className="text-sm font-semibold">{selectedFeedback.studentName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-sm font-semibold">{selectedFeedback.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Message Type</p>
                  <Badge className={statusUtils.getMessageTypeColor(selectedFeedback.messageType)}>
                    {selectedFeedback.messageType}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date</p>
                  <p className="text-sm font-semibold">{formatUtils.formatDate(selectedFeedback.date)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Message</p>
                <div className="bg-muted/50 p-4 rounded-lg border-2">
                  <p className="text-sm">{selectedFeedback.message}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMessages;
