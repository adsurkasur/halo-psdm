import { FileText, AlertCircle, MessageCircle, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { reports, chatSessions, appointments, notifications } = useData();
  const navigate = useNavigate();

  if (!user) return null;

  const totalReports = reports.length;
  const unresolvedReports = reports.filter((r) => r.status !== "DONE").length;
  const openChats = chatSessions.filter((s) => s.status === "OPEN").length;
  const totalAppointments = appointments.length;

  const stats = [
    { label: "Total Laporan", value: totalReports, icon: FileText, color: "bg-primary", link: "/admin/laporan" },
    { label: "Belum Ditangani", value: unresolvedReports, icon: AlertCircle, color: "bg-destructive", link: "/admin/laporan" },
    { label: "Sesi Chat Terbuka", value: openChats, icon: MessageCircle, color: "bg-status-process", link: "/admin/chat" },
    { label: "Permintaan Janji Temu", value: totalAppointments, icon: Calendar, color: "bg-status-done", link: null },
  ];

  // Activity feed from user's notifications
  const userNotifs = notifications
    .filter((n) => n.user_id === user.id)
    .slice(0, 8);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold">Dasbor Admin</h1>

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

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}
