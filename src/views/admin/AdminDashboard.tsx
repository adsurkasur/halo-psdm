import { FileText, AlertCircle, MessageCircle, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { reports, chatSessions, appointments, notifications, lastSyncedAt, isBusy } = useData();
  const navigate = useNavigate();

  if (!user) return null;

  const totalReports = reports.length;
  const unresolvedReports = reports.filter((r) => r.status !== "DONE").length;
  const openChats = chatSessions.filter((s) => s.status === "OPEN").length;
  const openAppointments = appointments.filter((a) => a.status === "OPEN").length;

  const stats = [
    { label: "Total Laporan", value: totalReports, icon: FileText, color: "bg-primary", link: "/admin/laporan" },
    { label: "Belum Ditangani", value: unresolvedReports, icon: AlertCircle, color: "bg-destructive", link: "/admin/laporan" },
    { label: "Sesi Chat Terbuka", value: openChats, icon: MessageCircle, color: "bg-status-process", link: "/admin/chat" },
    { label: "Permintaan Janji Temu", value: openAppointments, icon: Calendar, color: "bg-status-done", link: "/admin/janji-temu" },
  ];

  // Activity feed from user's notifications
  const userNotifs = notifications
    .filter((n) => n.user_id === user.id)
    .slice(0, 8);

  return (
    <div className="space-y-6 page-enter">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-8 text-primary-foreground shadow-lg shadow-primary/10 transition-all duration-500 hover:shadow-xl hover:shadow-primary/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Dasbor PH</h1>
            <p className="mt-1 text-primary-foreground/80 text-sm font-medium">
              Selamat datang kembali, {user.name}. Mari kelola aspirasi hari ini.
            </p>
          </div>
          {user.role === "PH" && (
            <div className="flex flex-col items-start md:items-end bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <p className="text-[10px] uppercase tracking-wider opacity-70 font-bold mb-1">Status Sinkronisasi</p>
              <p className="text-xs font-semibold whitespace-nowrap">
                {isBusy ? "⚡ Sedang sinkron..." : `✅ ${formatLastSync(lastSyncedAt)}`}
              </p>
            </div>
          )}
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8 animate-float" />
        <div className="absolute bottom-0 left-1/3 w-20 h-20 bg-white/5 rounded-full translate-y-10" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card
            key={s.label}
            className={`${s.link ? "cursor-pointer hover:shadow-md" : ""} transition-shadow`}
            onClick={() => s.link && navigate(s.link)}
          >
            <CardContent className="py-5 flex items-center gap-4">
              <div className={`${s.color} p-2.5 rounded-xl text-primary-foreground shrink-0`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity Feed */}
      <Card>
        <CardContent className="pt-5">
          <h2 className="font-semibold text-base mb-4">Aktivitas Terbaru</h2>
          <div className="space-y-3">
            {userNotifs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Belum ada aktivitas.
              </p>
            ) : (
              userNotifs.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    !n.is_read ? "bg-accent/30 hover:bg-accent/50" : "bg-muted hover:bg-muted/80"
                  }`}
                  onClick={() => n.link && navigate(n.link)}
                >
                  <div className={`h-2 w-2 mt-1.5 rounded-full shrink-0 ${!n.is_read ? "bg-primary" : "bg-border"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatTimeAgo(n.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatLastSync(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return "belum tersedia";
  try {
    const date = new Date(lastSyncedAt);
    return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "error";
  }
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} menit lalu`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  return past.toLocaleDateString("id-ID");
}
