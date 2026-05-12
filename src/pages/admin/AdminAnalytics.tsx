import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  FileText, CheckCircle, Clock, Hourglass, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const STATUS_COLORS: Record<string, string> = {
  Completed:  '#639922',
  Processing: '#378ADD',
  Pending:    '#BA7517',
  Ready:      '#7F77DD',
  Rejected:   '#E24B4A',
};

const STATUS_BADGE: Record<string, string> = {
  Completed:  'bg-green-100  text-green-800',
  Processing: 'bg-blue-100   text-blue-800',
  Pending:    'bg-amber-100  text-amber-800',
  Ready:      'bg-purple-100 text-purple-800',
  Rejected:   'bg-red-100    text-red-800',
};

const DOC_BAR_COLOR = '#378ADD';

const AdminAnalytics = () => {
  const [loading, setLoading] = useState(true);

  // KPI state
  const [totalRequests,    setTotalRequests]    = useState(0);
  const [completionRate,   setCompletionRate]   = useState('0');
  const [avgProcessingDay, setAvgProcessingDay] = useState('0');
  const [pendingCount,     setPendingCount]     = useState(0);

  // Chart state
  const [monthlyData,   setMonthlyData]   = useState<any[]>([]);
  const [statusData,    setStatusData]    = useState<any[]>([]);
  const [docTypeData,   setDocTypeData]   = useState<any[]>([]);
  const [processingByDoc, setProcessingByDoc] = useState<any[]>([]);
  const [recentRequests,  setRecentRequests]  = useState<any[]>([]);

  useEffect(() => { fetchAnalytics(); }, []);

  const fetchAnalytics = async () => {
    try {
      // ── Fetch all requests with items ───────────────────────────────
      const { data: requests } = await supabase
        .from('document_requests')
        .select('*, document_request_items(*)')
        .order('created_at', { ascending: false });

      const all = requests || [];

      // ── KPIs ────────────────────────────────────────────────────────
      const total     = all.length;
      const completed = all.filter(r => r.status === 'Completed');
      const pending   = all.filter(r =>
        r.status === 'Pending' || r.status === 'pending'
      ).length;

      const rate = total > 0
        ? ((completed.length / total) * 100).toFixed(1)
        : '0';

      // Avg processing time in days for completed requests
      const processingTimes = completed
        .filter(r => r.completed_at && r.created_at)
        .map(r => {
          const ms = new Date(r.completed_at).getTime() - new Date(r.created_at).getTime();
          return ms / (1000 * 60 * 60 * 24);
        });
      const avgDays = processingTimes.length > 0
        ? (processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length).toFixed(1)
        : '0';

      setTotalRequests(total);
      setCompletionRate(rate);
      setAvgProcessingDay(avgDays);
      setPendingCount(pending);

      // ── Monthly submitted vs completed ───────────────────────────────
      const monthOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const monthMap: Record<string, { submitted: number; completed: number }> = {};
      all.forEach(r => {
        const m = new Date(r.created_at).toLocaleString('en-US', { month: 'short' });
        if (!monthMap[m]) monthMap[m] = { submitted: 0, completed: 0 };
        monthMap[m].submitted += 1;
        if (r.status === 'Completed') monthMap[m].completed += 1;
      });
      const monthly = monthOrder
        .filter(m => monthMap[m])
        .map(m => ({ month: m, ...monthMap[m] }));
      setMonthlyData(monthly);

      // ── Status breakdown ─────────────────────────────────────────────
      const statusMap: Record<string, number> = {};
      all.forEach(r => {
        const s = r.status || 'Pending';
        statusMap[s] = (statusMap[s] || 0) + 1;
      });
      setStatusData(
        Object.entries(statusMap).map(([name, value]) => ({
          name,
          value,
          color: STATUS_COLORS[name] || '#888',
          pct: total > 0 ? Math.round((value / total) * 100) : 0,
        }))
      );

      // ── Top document types ───────────────────────────────────────────
      const docMap: Record<string, number> = {};
      all.forEach(r => {
        (r.document_request_items || []).forEach((item: any) => {
          const t = item.document_type || 'Unknown';
          docMap[t] = (docMap[t] || 0) + 1;
        });
      });
      const sortedDocs = Object.entries(docMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const maxDoc = sortedDocs[0]?.[1] || 1;
      setDocTypeData(
        sortedDocs.map(([name, count]) => ({
          name,
          count,
          pct: Math.round((count / maxDoc) * 100),
        }))
      );

      // ── Avg processing time per doc type ─────────────────────────────
      const docTimeMap: Record<string, number[]> = {};
      completed
        .filter(r => r.completed_at && r.created_at)
        .forEach(r => {
          const days =
            (new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) /
            (1000 * 60 * 60 * 24);
          (r.document_request_items || []).forEach((item: any) => {
            const t = item.document_type || 'Unknown';
            if (!docTimeMap[t]) docTimeMap[t] = [];
            docTimeMap[t].push(days);
          });
        });
      const maxTime = Math.max(
        ...Object.values(docTimeMap).map(arr => arr.reduce((a, b) => a + b, 0) / arr.length),
        1
      );
      const sortedTimes = Object.entries(docTimeMap)
        .map(([name, arr]) => ({
          name,
          avg: parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)),
        }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 5)
        .map(d => ({
          ...d,
          pct: Math.round((d.avg / maxTime) * 100),
          color: d.avg >= 4 ? '#E24B4A' : d.avg >= 2 ? '#BA7517' : '#639922',
        }));
      setProcessingByDoc(sortedTimes);

      // ── Recent requests ──────────────────────────────────────────────
      setRecentRequests(all.slice(0, 8));

    } catch (err) {
      console.error('Analytics error:', err);
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

  const kpis = [
    {
      label:   'Total requests',
      value:   totalRequests.toLocaleString(),
      icon:    FileText,
      sub:     `${pendingCount} still pending`,
      subColor:'text-muted-foreground',
    },
    {
      label:   'Completion rate',
      value:   `${completionRate}%`,
      icon:    CheckCircle,
      sub:     `${Math.round(totalRequests * parseFloat(completionRate) / 100)} completed`,
      subColor:'text-green-600',
    },
    {
      label:   'Avg. processing time',
      value:   `${avgProcessingDay}d`,
      icon:    Clock,
      sub:     'For completed requests',
      subColor:'text-muted-foreground',
    },
    {
      label:   'Pending requests',
      value:   pendingCount.toLocaleString(),
      icon:    Hourglass,
      sub:     'Awaiting action',
      subColor: pendingCount > 20 ? 'text-red-500' : 'text-muted-foreground',
    },
  ];

  return (
    <div className="space-y-6">

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <Card key={i} className="border">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
                  <p className="text-2xl font-medium">{k.value}</p>
                  <p className={`text-xs mt-1 ${k.subColor}`}>{k.sub}</p>
                </div>
                <div className="bg-muted rounded-md p-2 mt-0.5">
                  <k.icon className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Charts row 1 ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Monthly trend */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Monthly requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <>
                <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#378ADD' }} />
                    Submitted
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#639922' }} />
                    Completed
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid rgba(128,128,128,0.2)' }}
                    />
                    <Bar dataKey="submitted" fill="#378ADD" radius={[4,4,0,0]} name="Submitted" />
                    <Bar dataKey="completed" fill="#639922" radius={[4,4,0,0]} name="Completed" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status breakdown */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Status breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%" cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any, name: string) => [v, name]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid rgba(128,128,128,0.2)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 flex-1">
                  {statusData.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                      <span className="flex-1 text-muted-foreground">{s.name}</span>
                      <span className="font-medium">{s.pct}%</span>
                      <span className="text-muted-foreground text-xs">({s.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No data yet
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── Charts row 2 ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top requested documents */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Top requested documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {docTypeData.length > 0 ? docTypeData.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-28 truncate">{d.name}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${d.pct}%`, background: DOC_BAR_COLOR }}
                  />
                </div>
                <span className="text-xs font-medium w-7 text-right">{d.count}</span>
              </div>
            )) : (
              <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                No data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Avg processing time per doc */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Avg. processing time by document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {processingByDoc.length > 0 ? processingByDoc.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-28 truncate">{d.name}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${d.pct}%`, background: d.color }}
                  />
                </div>
                <span className="text-xs font-medium w-10 text-right">{d.avg}d</span>
              </div>
            )) : (
              <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                No completed requests yet
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── Recent requests table ───────────────────────────────────────── */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Recent requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentRequests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Student</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Document</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Submitted</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.map((r, i) => {
                    const docTypes = (r.document_request_items || [])
                      .map((item: any) => item.document_type)
                      .filter(Boolean)
                      .join(', ') || '—';
                    const submitted = new Date(r.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric',
                    });
                    const badgeClass = STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-700';
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 px-3 font-medium">
                          {r.student_name || r.full_name || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground max-w-[160px] truncate">
                          {docTypes}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{submitted}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No requests yet
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default AdminAnalytics;