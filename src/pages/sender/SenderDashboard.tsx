import { useNavigate } from "react-router-dom";
import { FileText, MessageCircle, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UrgencyBadge, StatusBadge } from "@/components/shared/StatusBadges";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { CATEGORY_LABELS } from "@/data/mockData";

const quickActions = [
  { title: "Buat Laporan / Pengaduan", desc: "Laporkan masalah yang Anda alami", icon: FileText, url: "/laporan/buat", color: "bg-primary" },
  { title: "Mulai Sesi Curhat", desc: "Ceritakan keluh kesah Anda", icon: MessageCircle, url: "/chat", color: "bg-status-done" },
  { title: "Order Janji Temu", desc: "Jadwalkan pertemuan dengan admin", icon: Calendar, url: "/janji-temu", color: "bg-status-process" },
];

export default function SenderDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { reports } = useData();

  if (!user) return null;

  const myReports = reports.filter((r) => r.user_id === user.id).slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <Card className="bg-primary text-primary-foreground border-0">
        <CardContent className="py-6">
          <h1 className="text-2xl font-bold">Halo, {user.name}! 👋</h1>
          <p className="mt-1 opacity-90">Ada yang bisa kami bantu hari ini?</p>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {quickActions.map((a) => (
          <Card
            key={a.title}
            className="cursor-pointer hover:shadow-md transition-shadow group"
            onClick={() => navigate(a.url)}
          >
            <CardContent className="py-5 flex items-start gap-4">
              <div className={`${a.color} p-2.5 rounded-xl text-primary-foreground shrink-0`}>
                <a.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{a.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Reports */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base">Laporan Aktif Saya</h2>
            <button
              className="text-xs text-primary font-medium hover:underline"
              onClick={() => navigate("/laporan")}
            >
              Lihat Semua →
            </button>
          </div>
          {myReports.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Belum ada laporan. Buat laporan baru untuk memulai.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Kasus</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Urgensi</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myReports.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/laporan/${r.id}`)}
                    >
                      <TableCell className="font-mono text-xs">{r.case_id}</TableCell>
                      <TableCell className="text-sm">{CATEGORY_LABELS[r.category]}</TableCell>
                      <TableCell><UrgencyBadge urgency={r.urgency} /></TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
