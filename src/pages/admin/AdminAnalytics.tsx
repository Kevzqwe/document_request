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
} from 'lucide-react';
import { requestStorage, StoredRequest } from '@/lib/requestStorage';

const AdminAnalytics = () => {
  const [requests, setRequests] = useState<StoredRequest[]>([]);

  useEffect(() => {
    // Get both active and archived requests for complete analytics
    const allRequests = [...requestStorage.getAll(), ...requestStorage.getArchived()];
    setRequests(allRequests);
  }, []);

  // Calculate stats from real data
  const totalRequests = requests.length;
  const completedRequests = requests.filter(r => r.status === 'Completed').length;
  const totalRevenue = requests.reduce((sum, r) => sum + parseFloat(r.amount.replace(/[^0-9.]/g, '') || '0'), 0);
  const completionRate = totalRequests > 0 ? ((completedRequests / totalRequests) * 100).toFixed(1) : '0';

  // Group requests by month
  const requestsByMonth = requests.reduce((acc, request) => {
    const month = new Date(request.requestDate).toLocaleString('en-US', { month: 'short' });
    const existing = acc.find(item => item.month === month);
    if (existing) {
      existing.requests += 1;
      if (request.status === 'Completed') existing.completed += 1;
    } else {
      acc.push({
        month,
        requests: 1,
        completed: request.status === 'Completed' ? 1 : 0,
      });
    }
    return acc;
  }, [] as { month: string; requests: number; completed: number }[]);

  // Group by document type
  const documentTypeCounts = requests.reduce((acc, request) => {
    request.documents.forEach(doc => {
      const existing = acc.find(d => d.name === doc);
      if (existing) {
        existing.value += 1;
      } else {
        acc.push({ name: doc, value: 1 });
      }
    });
    return acc;
  }, [] as { name: string; value: number }[]);

  const COLORS = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B'];
  const documentTypes = documentTypeCounts.map((doc, index) => ({
    ...doc,
    color: COLORS[index % COLORS.length],
  }));

  // Group by payment method
  const paymentMethodCounts = requests.reduce((acc, request) => {
    const amount = parseFloat(request.amount.replace(/[^0-9.]/g, '') || '0');
    const existing = acc.find(p => p.method === request.paymentMethod);
    if (existing) {
      existing.amount += amount;
      existing.count += 1;
    } else {
      acc.push({ method: request.paymentMethod, amount: amount, count: 1 });
    }
    return acc;
  }, [] as { method: string; amount: number; count: number }[]);

  const totalPayments = paymentMethodCounts.reduce((sum, p) => sum + p.amount, 0);
  const paymentMethods = paymentMethodCounts.map(p => ({
    ...p,
    percentage: totalPayments > 0 ? Math.round((p.amount / totalPayments) * 100) : 0,
  }));

  // Revenue by month
  const revenueByMonth = requests.reduce((acc, request) => {
    const month = new Date(request.requestDate).toLocaleString('en-US', { month: 'short' });
    const amount = parseFloat(request.amount.replace(/[^0-9.]/g, '') || '0');
    const existing = acc.find(item => item.month === month);
    if (existing) {
      existing.revenue += amount;
    } else {
      acc.push({ month, revenue: amount });
    }
    return acc;
  }, [] as { month: string; revenue: number }[]);

  const stats = [
    {
      title: 'Total Requests',
      value: totalRequests.toString(),
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Total Students',
      value: new Set(requests.map(r => r.studentName)).size.toString(),
      icon: Users,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Completion Rate',
      value: `${completionRate}%`,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Total Revenue',
      value: `₱${totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Completed',
      value: completedRequests.toString(),
      icon: Calendar,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Processing',
      value: requests.filter(r => r.status === 'Processing').length.toString(),
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
            {requestsByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={requestsByMonth}>
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
            {documentTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={documentTypes}
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
                    {documentTypes.map((entry, index) => (
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
            {revenueByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueByMonth}>
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
            {paymentMethods.length > 0 ? (
              <div className="space-y-6">
                {paymentMethods.map((payment, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">{payment.method}</span>
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
          {documentTypes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold">Document</th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Total Requests
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {documentTypes
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
