import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UrgencyBadge, StatusBadge } from "@/components/shared/StatusBadges";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { CATEGORY_LABELS, STATUS_LABELS, mockUsers } from "@/data/mockData";

export default function SenderReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { reports, statusHistory, chatSessions } = useData();

  if (!user) return null;

  const report = reports.find((r) => r.id === id);
  if (!report) {
    return (
      <div className="animate-fade-in text-center py-20">
        <p className="text-muted-foreground">Laporan tidak ditemukan.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/laporan")}>
          Kembali
        </Button>
      </div>
    );
  }

  const history = statusHistory
    .filter((h) => h.report_id === report.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const linkedChat = chatSessions.find(
    (cs) => cs.report_id === report.id && cs.status === "OPEN"
  );

  const senderUser = mockUsers.find((u) => u.id === report.user_id);

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/laporan")} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Button>

      {/* Report Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Detail Laporan — {report.case_id}</CardTitle>
            <StatusBadge status={report.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Pengirim</p>
              <p className="font-medium">{report.is_anonymous ? "Anonim" : senderUser?.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Kategori</p>
              <p className="font-medium">{CATEGORY_LABELS[report.category]}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Urgensi</p>
              <UrgencyBadge urgency={report.urgency} />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Tanggal</p>
              <p className="font-medium text-xs">{new Date(report.created_at).toLocaleString("id-ID")}</p>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground text-xs mb-1">Kronologi</p>
            <p className="text-sm bg-muted p-3 rounded-lg">{report.kronologi}</p>
          </div>

          {/* Clarification chat link */}
          {report.status === "NEEDS_CLARIFICATION" && linkedChat && (
            <Button
              variant="outline"
              className="w-full gap-2 border-primary text-primary"
              onClick={() => navigate(`/chat/${linkedChat.id}`)}
            >
              <MessageCircle className="h-4 w-4" />
              Buka Chat Klarifikasi
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Status Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {history.map((h, i) => {
              const changer = h.changed_by === "system"
                ? "Sistem"
                : mockUsers.find((u) => u.id === h.changed_by)?.name ?? "Admin";
              return (
                <div key={h.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`h-3 w-3 rounded-full shrink-0 mt-1 ${
                      i === history.length - 1 ? "bg-primary" : "bg-border"
                    }`} />
                    {i < history.length - 1 && <div className="w-0.5 flex-1 bg-border" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium">{STATUS_LABELS[h.new_status]}</p>
                    {h.note && <p className="text-xs text-muted-foreground mt-0.5">{h.note}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {changer} · {new Date(h.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
