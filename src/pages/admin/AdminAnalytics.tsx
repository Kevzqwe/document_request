import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Users,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AnalyticsData {
  totalRequests: number;
  totalStudents: number;
  completedRequests: number;
  processingRequests: number;
  totalRevenue: number;
  completionRate: string;
  requestsByMonth: { month: string; requests: number; completed: number }[];
  documentTypes: { name: string; value: number; color: string }[];
  paymentMethods: { method: string; amount: number; count: number; percentage: number }[];
  revenueByMonth: { month: string; revenue: number }[];
}

const COLORS = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B'];

const AdminAnalytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch all document requests
      const { data: requests, error: reqError } = await supabase
        .from('document_requests')
        .select('*, document_request_items(*)');

      if (reqError) {
        console.error('Error fetching requests:', reqError);
        return;
      }

      // Fetch all payments
      const { data: payments, error: payError } = await supabase
        .from('payments')
        .select('*');

      if (payError) {
        console.error('Error fetching payments:', payError);
      }

      const allRequests = requests || [];
      const allPayments = payments || [];

      // Basic stats
      const totalRequests = allRequests.length;
      const completedRequests = allRequests.filter(r => r.status === 'Completed').length;
      const processingRequests = allRequests.filter(r => r.status === 'Processing').length;
      const totalRevenue = allRequests.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
      const totalStudents = new Set(allRequests.map(r => r.user_id)).size;
      const completionRate = totalRequests > 0
        ? ((completedRequests / totalRequests) * 100).toFixed(1)
        : '0';

      // Requests by month
      const monthMap: Record<string, { requests: number; completed: number }> = {};
      allRequests.forEach(req => {
        const month = new Date(req.created_at).toLocaleString('en-US', { month: 'short' });
        if (!monthMap[month]) monthMap[month] = { requests: 0, completed: 0 };
        monthMap[month].requests += 1;
        if (req.status === 'Completed') monthMap[month].completed += 1;
      });
      const requestsByMonth = Object.entries(monthMap).map(([month, data]) => ({
        month,
        ...data,
      }));

      // Document types
      const docMap: Record<string, number> = {};
      allRequests.forEach(req => {
        const items = req.document_request_items || [];
        items.forEach((item: any) => {
          const docType = item.document_type;
          docMap[docType] = (docMap[docType] || 0) + 1;
        });
      });
      const documentTypes = Object.entries(docMap).map(([name, value], index) => ({
        name,
        value,
        color: COLORS[index % COLORS.length],
      }));

      // Payment methods from payments table
      const paymentMap: Record<string, { amount: number; count: number }> = {};
      allPayments.forEach(pay => {
        const method = pay.payment_method || 'Unknown';
        if (!paymentMap[method]) paymentMap[method] = { amount: 0, count: 0 };
        paymentMap[method].amount += Number(pay.amount || 0);
        paymentMap[method].count += 1;
      });
      const totalPaymentAmount = Object.values(paymentMap).reduce((sum, p) => sum + p.amount, 0);
      const paymentMethods = Object.entries(paymentMap).map(([method, data]) => ({
        method,
        ...data,
        percentage: totalPaymentAmount > 0
          ? Math.round((data.amount / totalPaymentAmount) * 100)
          : 0,
      }));

      // Revenue by month
      const revenueMap: Record<string, number> = {};
      allRequests.forEach(req => {
        const month = new Date(req.created_at).toLocaleString('en-US', { month: 'short' });
        revenueMap[month] = (revenueMap[month] || 0) + Number(req.total_amount || 0);
      });
      const revenueByMonth = Object.entries(revenueMap).map(([month, revenue]) => ({
        month,
        revenue,
      }));

      setAnalytics({
        totalRequests,
        totalStudents,
        completedRequests,
        processingRequests,
        totalRevenue,
        completionRate,
        requestsByMonth,
        documentTypes,
        paymentMethods,
        revenueByMonth,
      });
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!analytics) return null;

  const stats = [
    {
      title: 'Total Requests',
      value: analytics.totalRequests.toString(),
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Total Students',
      value: analytics.totalStudents.toString(),
      icon: Users,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Completion Rate',
      value: `${analytics.completionRate}%`,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Total Revenue',
      value: `₱${analytics.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Completed',
      value: analytics.completedRequests.toString(),
      icon: Calendar,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Processing',
      value: analytics.processingRequests.toString(),
      icon: TrendingUp,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="border-2">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {stat.title}
                  </p>
                  <h3 className="text-3xl font-bold mb-2">{stat.value}</h3>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests Trend */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Requests Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.requestsByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.requestsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="requests" fill="#8B5CF6" name="Total Requests" />
                  <Bar dataKey="completed" fill="#10B981" name="Completed" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No request data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document Types Distribution */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Document Types Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.documentTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.documentTypes}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics.documentTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No document data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.revenueByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `₱${Number(value).toLocaleString()}`} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    name="Revenue"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.paymentMethods.length > 0 ? (
              <div className="space-y-6">
                {analytics.paymentMethods.map((payment, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold capitalize">{payment.method}</span>
                      <span className="text-sm text-muted-foreground">
                        {payment.percentage}%
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all"
                          style={{ width: `${payment.percentage}%` }}
                        />
                      </div>
                      <span className="font-bold min-w-[100px] text-right">
                        ₱{payment.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No payment data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Documents Table */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Top Requested Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.documentTypes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold">Document</th>
                    <th className="text-left py-3 px-4 font-semibold">Total Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.documentTypes
                    .sort((a, b) => b.value - a.value)
                    .map((doc, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-bold">#{index + 1}</td>
                        <td className="py-3 px-4">{doc.name}</td>
                        <td className="py-3 px-4">{doc.value}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No document requests yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalytics;