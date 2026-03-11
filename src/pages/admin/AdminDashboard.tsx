import { FileText, AlertCircle, MessageCircle, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { mockActivityFeed } from "@/data/mockData";

const stats = [
  { label: "Total Laporan", value: 24, icon: FileText, color: "bg-primary" },
  { label: "Belum Ditangani", value: 5, icon: AlertCircle, color: "bg-destructive" },
  { label: "Sesi Chat Terbuka", value: 3, icon: MessageCircle, color: "bg-status-process" },
  { label: "Permintaan Janji Temu", value: 12, icon: Calendar, color: "bg-status-done" },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold">Dasbor Admin</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
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
            {mockActivityFeed.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <div className="h-2 w-2 mt-1.5 rounded-full bg-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm">{a.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
