import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleProvider, useRole } from "@/contexts/RoleContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import SenderDashboard from "@/pages/sender/SenderDashboard";
import ReportForm from "@/pages/sender/ReportForm";
import ChatRoom from "@/pages/sender/ChatRoom";
import AppointmentDirectory from "@/pages/sender/AppointmentDirectory";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import ReportManagement from "@/pages/admin/ReportManagement";
import ReportDetail from "@/pages/admin/ReportDetail";
import AdminChatQueue from "@/pages/admin/AdminChatQueue";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { isSender } = useRole();

  return (
    <DashboardLayout>
      <Routes>
        {/* Sender routes */}
        <Route path="/" element={isSender ? <SenderDashboard /> : <Navigate to="/admin/dasbor" replace />} />
        <Route path="/laporan/buat" element={<ReportForm />} />
        <Route path="/chat/room" element={<ChatRoom />} />
        <Route path="/janji-temu" element={<AppointmentDirectory />} />

        {/* Admin routes */}
        <Route path="/admin/dasbor" element={!isSender ? <AdminDashboard /> : <Navigate to="/" replace />} />
        <Route path="/admin/laporan" element={<ReportManagement />} />
        <Route path="/admin/laporan/:id" element={<ReportDetail />} />
        <Route path="/admin/chat" element={<AdminChatQueue />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </DashboardLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <RoleProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </RoleProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
