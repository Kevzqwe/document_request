import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
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

const queryClient = new QueryClient();

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
              {/* Student */}
              <Route path="/student/dashboard" element={<Dashboard />} />
              <Route path="/student/document-request" element={<DocumentRequest />} />
              <Route path="/student/request-history" element={<RequestHistory />} />
              <Route path="/student/account" element={<Account />} />

              {/* Admin */}
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/request-documents" element={<AdminRequestDocuments />} />
              <Route path="/admin/messages" element={<AdminMessages />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/payments" element={<AdminPayments />} />
              <Route path="/admin/account" element={<AdminAccount />} />
              <Route path="/admin/students" element={<AdminStudentManagement />} />
              <Route path="/admin/admins" element={<AdminManagement />} />
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