import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
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

function AppLoadingScreen() {
  const [showLongWaitHint, setShowLongWaitHint] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowLongWaitHint(true);
    }, 3500);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="font-medium">Memuat sesi akun...</p>
        <p className="text-sm text-muted-foreground mt-1">Menyiapkan data profil dan akses halaman.</p>
        {showLongWaitHint && (
          <p className="text-xs text-amber-600 mt-3">
            Memuat lebih lama dari biasanya. Koneksi ke server mungkin sedang lambat.
          </p>
        )}
      </div>
    </div>
  );
}

export function ProtectedRoutes() {
  const { isAuthenticated, isSender, isPh, isLoading } = useAuth();

  if (isLoading) {
    return <AppLoadingScreen />;
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
          element={isPh ? <AdminDashboard /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/laporan"
          element={isPh ? <ReportManagement /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/laporan/:id"
          element={isPh ? <ReportDetail /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/chat"
          element={isPh ? <AdminChatQueue /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/rekap"
          element={isPh ? <AdminRekap /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/kelola-admin"
          element={isPh ? <AdminManagement /> : <Navigate to="/" replace />}
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </DashboardLayout>
  );
}

export function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const isRecoveryRoute = searchParams.get("recovery") === "1" || hashParams.get("type") === "recovery";

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated && !isRecoveryRoute ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
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
