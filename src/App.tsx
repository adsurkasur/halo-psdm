import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ThemeProvider } from "next-themes";

// Pages
import LoginPage from "@/views/LoginPage";
import SenderDashboard from "@/views/sender/SenderDashboard";
import ReportForm from "@/views/sender/ReportForm";
import SenderReportList from "@/views/sender/SenderReportList";
import SenderReportDetail from "@/views/sender/SenderReportDetail";
import ProfilePage from "@/views/ProfilePage";
import ChatSessionList from "@/views/sender/ChatSessionList";
import ChatRoom from "@/views/sender/ChatRoom";
import AppointmentDirectory from "@/views/sender/AppointmentDirectory";
import AdminDashboard from "@/views/admin/AdminDashboard";
import ReportManagement from "@/views/admin/ReportManagement";
import ReportDetail from "@/views/admin/ReportDetail";
import AdminChatQueue from "@/views/admin/AdminChatQueue";
import AdminRekap from "@/views/admin/AdminRekap";
import AdminManagement from "@/views/admin/AdminManagement";
import NotFound from "./views/NotFound";

const queryClient = new QueryClient();

export function ProtectedRoutes() {
  const { isAuthenticated, isSender, isAdmin, isSuperAdmin, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-[40vh]" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <DashboardLayout>
      <Routes>
        {/* Sender routes */}
        <Route
          path="/"
          element={isSender ? <SenderDashboard /> : <Navigate to="/admin/dasbor" replace />}
        />
        {/* alias for legacy /dashboard path */}
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/laporan" element={isSender ? <SenderReportList /> : <Navigate to="/admin/laporan" replace />} />
        <Route path="/laporan/buat" element={<ReportForm />} />
        <Route path="/laporan/:id" element={<SenderReportDetail />} />
        <Route path="/chat" element={<ChatSessionList />} />
        <Route path="/chat/:sessionId" element={<ChatRoom />} />
        <Route path="/janji-temu" element={<AppointmentDirectory />} />
        {/* profile settings for all users */}
        <Route path="/profile" element={<ProfilePage />} />

        {/* Admin routes */}
        <Route
          path="/admin/dasbor"
          element={isAdmin ? <AdminDashboard /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/laporan"
          element={isAdmin ? <ReportManagement /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/laporan/:id"
          element={isAdmin ? <ReportDetail /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/chat"
          element={isAdmin ? <AdminChatQueue /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/rekap"
          element={isSuperAdmin ? <AdminRekap /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/kelola-admin"
          element={isSuperAdmin ? <AdminManagement /> : <Navigate to="/" replace />}
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </DashboardLayout>
  );
}

export function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-[40vh]" />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <DataProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </DataProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
