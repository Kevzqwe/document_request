import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import OtpVerification from "./pages/OtpVerification";

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

// ── Spinner shared by guards ──────────────────────────────────────────────────
const Spinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// ── PublicGuard ───────────────────────────────────────────────────────────────
// Only accessible when NOT authenticated (login, otp-verify).
// If already logged in → redirect to their dashboard.
// If auth is still loading → show spinner so we don't flash login then redirect.
const PublicGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, profile, isLoading } = useAuth();

  if (isLoading) return <Spinner />;

  if (isAuthenticated && profile) {
    return <Navigate to={getRedirectPath(profile.role)} replace />;
  }

  return <>{children}</>;
};

// ── RoleGuard ─────────────────────────────────────────────────────────────────
// Only accessible when authenticated AND role matches.
// Not authenticated → login. Wrong role → their correct dashboard.
interface RoleGuardProps {
  allowedRoles: UserProfile['role'][];
  children: React.ReactNode;
}

const RoleGuard = ({ allowedRoles, children }: RoleGuardProps) => {
  const { profile, isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <Spinner />;

  if (!isAuthenticated || !profile) return <Navigate to="/" replace />;

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

            {/* ── Public: only visible when NOT logged in ──────────────── */}
            <Route path="/" element={
              <PublicGuard><Login /></PublicGuard>
            } />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/otp-verify" element={
              <PublicGuard><OtpVerification /></PublicGuard>
            } />

            {/* ── Protected: Layout wraps all dashboard routes ─────────── */}
            <Route element={<Layout />}>

              {/* Student */}
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

              {/* Admin + Cashier + Program Head */}
              <Route path="/admin/dashboard" element={
                <RoleGuard allowedRoles={['admin', 'cashier', 'programhead']}>
                  <AdminDashboard />
                </RoleGuard>
              } />
              <Route path="/admin/account" element={
                <RoleGuard allowedRoles={['admin', 'cashier', 'programhead']}>
                  <AdminAccount />
                </RoleGuard>
              } />

              {/* Admin only */}
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
              <Route path="/admin/admins" element={
                <RoleGuard allowedRoles={['admin']}>
                  <AdminManagement />
                </RoleGuard>
              } />

              {/* Admin + Cashier */}
              <Route path="/admin/payments" element={
                <RoleGuard allowedRoles={['admin', 'cashier']}>
                  <AdminPayments />
                </RoleGuard>
              } />

              {/* Admin + Program Head */}
              <Route path="/admin/students" element={
                <RoleGuard allowedRoles={['admin', 'programhead']}>
                  <AdminStudentManagement />
                </RoleGuard>
              } />

            </Route>

            {/* ── Payment pages (no auth required, no Layout) ──────────── */}
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/payment-cancel"  element={<PaymentCancel />} />

            {/* ── Legacy redirects ─────────────────────────────────────── */}
            <Route path="/dashboard"        element={<Navigate to="/student/dashboard"        replace />} />
            <Route path="/document-request" element={<Navigate to="/student/document-request" replace />} />
            <Route path="/request-history"  element={<Navigate to="/student/request-history"  replace />} />
            <Route path="/account"          element={<Navigate to="/student/account"          replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;