import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";

// Student pages
import Dashboard from "./pages/student/Dashboard";
import DocumentRequest from "./pages/student/DocumentRequest";
import RequestHistory from "./pages/student/RequestHistory";
import Account from "./pages/student/Account";
import PaymentSuccess from "./pages/student/PaymentSuccess";
import PaymentCancel from "./pages/student/PaymentCancel";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminRequestDocuments from "./pages/admin/AdminRequestDocuments";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminAccount from "./pages/admin/AdminAccount";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminStudentManagement from "./pages/admin/AdminStudentManagement";
import AdminManagement from "@/pages/admin/AdminManagement";

import NotFound from "./pages/NotFound";
import { getRedirectPath } from "./lib/auth";
import type { UserProfile } from "./lib/auth";

const queryClient = new QueryClient();

// ── Role-based route guard ────────────────────────────────────────────────────
// allowedRoles: which roles can access this route
// If the user's role is not in the list, redirect them to their own home page
interface RoleGuardProps {
  allowedRoles: UserProfile['role'][];
  children: React.ReactNode;
}

const RoleGuard = ({ allowedRoles, children }: RoleGuardProps) => {
  const { profile, isLoading, isAuthenticated } = useAuth();

  // Still loading — render nothing to avoid flash
  if (isLoading) return null;

  // Not logged in — send to login
  if (!isAuthenticated || !profile) return <Navigate to="/" replace />;

  // Role not allowed — redirect to their own home page
  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to={getRedirectPath(profile.role)} replace />;
  }

  return <>{children}</>;
};

// ── App ───────────────────────────────────────────────────────────────────────
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Navigate to="/" replace />} />

            {/* All authenticated routes share Layout */}
            <Route element={<Layout />}>

              {/* ── Student-only routes ────────────────────────────────── */}
              <Route path="/student/dashboard" element={
                <RoleGuard allowedRoles={['student']}>
                  <Dashboard />
                </RoleGuard>
              } />
              <Route path="/student/document-request" element={
                <RoleGuard allowedRoles={['student']}>
                  <DocumentRequest />
                </RoleGuard>
              } />
              <Route path="/student/request-history" element={
                <RoleGuard allowedRoles={['student']}>
                  <RequestHistory />
                </RoleGuard>
              } />
              <Route path="/student/account" element={
                <RoleGuard allowedRoles={['student']}>
                  <Account />
                </RoleGuard>
              } />

              {/* ── Admin-only routes ──────────────────────────────────── */}
              <Route path="/admin/dashboard" element={
                <RoleGuard allowedRoles={['admin']}>
                  <AdminDashboard />
                </RoleGuard>
              } />
              <Route path="/admin/request-documents" element={
                <RoleGuard allowedRoles={['admin']}>
                  <AdminRequestDocuments />
                </RoleGuard>
              } />
              <Route path="/admin/messages" element={
                <RoleGuard allowedRoles={['admin']}>
                  <AdminMessages />
                </RoleGuard>
              } />
              <Route path="/admin/analytics" element={
                <RoleGuard allowedRoles={['admin']}>
                  <AdminAnalytics />
                </RoleGuard>
              } />
              <Route path="/admin/account" element={
                <RoleGuard allowedRoles={['admin']}>
                  <AdminAccount />
                </RoleGuard>
              } />
              <Route path="/admin/admins" element={
                <RoleGuard allowedRoles={['admin']}>
                  <AdminManagement />
                </RoleGuard>
              } />

              {/* ── Cashier-only routes ────────────────────────────────── */}
              <Route path="/admin/payments" element={
                <RoleGuard allowedRoles={['admin', 'cashier']}>
                  <AdminPayments />
                </RoleGuard>
              } />

              {/* ── Program Head-only routes ───────────────────────────── */}
              <Route path="/admin/students" element={
                <RoleGuard allowedRoles={['admin', 'programhead']}>
                  <AdminStudentManagement />
                </RoleGuard>
              } />

            </Route>

            {/* Payment pages (no Layout) */}
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/payment-cancel" element={<PaymentCancel />} />

            {/* Legacy redirects */}
            <Route path="/dashboard" element={<Navigate to="/student/dashboard" replace />} />
            <Route path="/document-request" element={<Navigate to="/student/document-request" replace />} />
            <Route path="/request-history" element={<Navigate to="/student/request-history" replace />} />
            <Route path="/account" element={<Navigate to="/student/account" replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;