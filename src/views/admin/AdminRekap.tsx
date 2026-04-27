import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORY_LABELS, STATUS_LABELS, type ReportStatus } from "@/data/domain";
import { useToast } from "@/hooks/use-toast";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const STATUS_COLORS: Record<ReportStatus, string> = {
  RECEIVED: "#f97316",
  IN_PROGRESS: "#eab308",
  NEEDS_CLARIFICATION: "#8b5cf6",
  DONE: "#22c55e",
};

const CATEGORY_COLORS = ["#f97316", "#3b82f6", "#ef4444", "#22c55e", "#8b5cf6"];

export default function AdminRekap() {
  const { reports, chatSessions, chatMessages, appointments } = useData();
  const { allUsers } = useAuth();
  const { toast } = useToast();

  // Status distribution
  const statusData = Object.entries(STATUS_LABELS).map(([key, label]) => ({
    name: label,
    value: reports.filter((r) => r.status === key).length,
    key,
  }));

  // Category distribution
  const categoryData = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
    name: label,
    count: reports.filter((r) => r.category === key).length,
  }));

  // Stats
  const totalReports = reports.length;
  const resolvedReports = reports.filter((r) => r.status === "DONE").length;
  const totalChatSessions = chatSessions.length;
  const totalMessages = chatMessages.length;
  const totalAppointments = appointments.length;
  const openAppointments = appointments.filter((a) => a.status === "OPEN").length;
  const doneAppointments = appointments.filter((a) => a.status === "DONE").length;
  const resolutionRate = totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 0;

  // CSV export
  const handleExport = () => {
    const header = "Case ID,Pengirim,Kategori,Urgensi,Status,Tanggal\n";
    const rows = reports.map((r) => {
      const sender = allUsers.find((u) => u.id === r.user_id);
      return [
        r.case_id,
        sender?.name ?? "-",
        CATEGORY_LABELS[r.category],
        r.urgency,
        STATUS_LABELS[r.status],
        new Date(r.created_at).toLocaleDateString("id-ID"),
      ].join(",");
    }).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rekap-halo-psdm-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: "Berhasil", description: "File CSV telah diunduh." });
  };

  return (
    <div className="space-y-6 page-enter">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-8 text-primary-foreground shadow-lg shadow-primary/10">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Rekap & Analitik</h1>
            <p className="mt-1 text-primary-foreground/80 text-sm font-medium">
              Ringkasan performa dan data statistik Halo PSDM.
            </p>
          </div>
          <Button 
            className="gap-2 bg-white text-primary hover:bg-white/90 border-0 shadow-lg" 
            onClick={handleExport}
          >
            <Download className="h-4 w-4" />
            Unduh CSV
          </Button>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8 animate-float" />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
        {[
          { label: "Total Laporan", value: totalReports },
          { label: "Tingkat Penyelesaian", value: `${resolutionRate}%` },
          { label: "Sesi Chat", value: totalChatSessions },
          { label: "Total Pesan", value: totalMessages },
          { label: "Janji Temu", value: totalAppointments },
          { label: "Janji Temu Aktif", value: openAppointments },
          { label: "Janji Temu Selesai", value: doneAppointments },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData.filter((d) => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.key} fill={STATUS_COLORS[entry.key as ReportStatus]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kategori Permasalahan</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]}>
                  {categoryData.map((_, idx) => (
                    <Cell key={idx} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
