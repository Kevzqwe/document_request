import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Bell, FileText, CheckCircle, Clock, MessageSquare, CheckCheck, Loader2 } from 'lucide-react';
import FeedbackModal from '@/components/FeedbackModal';
import ChatbaseWidget from '@/components/ChatbaseWidget';
import { supabase } from '@/integrations/supabase/client';

const CHATBASE_ID = 'qLBNkxXcRUo19x8-TuiJQ';

interface RequestDisplay {
  id: string;
  documents: string[];
  requestDate: string;
  status: string;
  amount: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
}

const Dashboard = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [requests, setRequests] = useState<RequestDisplay[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      // Fetch requests with items
      const { data: reqData } = await supabase
        .from('document_requests')
        .select('*, document_request_items(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (reqData) {
        setRequests(reqData.map(req => {
          const items = req.document_request_items || [];
          const totalAmount = items.reduce((sum: number, item: any) => sum + Number(item.price), 0);
          return {
            id: `REQ-${String(req.request_number).padStart(3, '0')}`,
            documents: items.map((item: any) => item.document_type),
            requestDate: req.created_at,
            status: req.status,
            amount: `₱${totalAmount.toLocaleString()}.00`,
          };
        }));
      }

      // Fetch announcements
      const { data: annData } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (annData) {
        setAnnouncements(annData.map(a => ({
          id: a.id,
          title: a.title,
          content: a.content,
          date: a.created_at,
        })));
      }

      setLoading(false);
    };

    fetchData();
  }, [user?.id]);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const totalRequests = requests.length;
  const approvedRequests = requests.filter(r => r.status === 'Approved' || r.status === 'Ready').length;
  const pendingRequests = requests.filter(r => r.status === 'Processing' || r.status === 'pending').length;
  const completedRequests = requests.filter(r => r.status === 'Completed').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-success text-success-foreground';
      case 'Approved': case 'Ready': return 'bg-primary text-primary-foreground';
      case 'Processing': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const recentTransactions = requests.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary to-primary-light rounded-2xl p-8 text-primary-foreground shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome back, {profile?.firstName}!</h1>
            <div className="flex items-center gap-2 text-primary-foreground/90">
              <Calendar className="w-5 h-5" />
              <p className="text-lg">{currentDate}</p>
            </div>
          </div>
          <Button onClick={() => setFeedbackOpen(true)} className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
            <MessageSquare className="w-4 h-4 mr-2" />Feedback
          </Button>
        </div>
      </div>

      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card
          className="border-2 hover:shadow-md transition-shadow cursor-pointer hover:border-primary/50"
          onClick={() => navigate('/student/request-history?filter=all')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
            <FileText className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests}</div>
            <p className="text-xs text-muted-foreground mt-1">All time requests</p>
          </CardContent>
        </Card>
        <Card
          className="border-2 hover:shadow-md transition-shadow cursor-pointer hover:border-primary/50"
          onClick={() => navigate('/student/request-history?filter=approved')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
            <CheckCircle className="w-4 h-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedRequests}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready for pickup</p>
          </CardContent>
        </Card>
        <Card
          className="border-2 hover:shadow-md transition-shadow cursor-pointer hover:border-primary/50"
          onClick={() => navigate('/student/request-history?filter=pending')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <Clock className="w-4 h-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests}</div>
            <p className="text-xs text-muted-foreground mt-1">Being processed</p>
          </CardContent>
        </Card>
        <Card
          className="border-2 hover:shadow-md transition-shadow cursor-pointer hover:border-primary/50"
          onClick={() => navigate('/student/request-history?filter=completed')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <CheckCheck className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedRequests}</div>
            <p className="text-xs text-muted-foreground mt-1">Successfully claimed</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <CardTitle>Announcements</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {announcements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No announcements at this time.</div>
          ) : (
            announcements.map((announcement) => (
              <div key={announcement.id} className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-foreground">{announcement.title}</h3>
                  <span className="text-xs text-muted-foreground">{new Date(announcement.date).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-foreground/80">{announcement.content}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <CardTitle>Track Your Requests</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No requests yet. Start by submitting a document request.</div>
          ) : (
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="p-4 bg-muted/50 rounded-lg border-2 hover:bg-muted transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-lg">{transaction.documents.join(', ')}</h4>
                      <p className="text-sm text-muted-foreground">Requested on {new Date(transaction.requestDate).toLocaleDateString()}</p>
                    </div>
                    <Badge className={getStatusColor(transaction.status)}>{transaction.status}</Badge>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Amount:</span>
                    <span className="font-bold">{transaction.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ChatbaseWidget chatbotId={CHATBASE_ID} />
    </div>
  );
};

export default Dashboard;
