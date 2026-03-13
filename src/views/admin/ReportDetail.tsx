import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UrgencyBadge, StatusBadge } from "@/components/shared/StatusBadges";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { BIRO_LABELS, JABATAN_LABELS, CATEGORY_LABELS, STATUS_LABELS, URGENCY_LABELS, type ReportStatus, type Urgency } from "@/data/domain";

const statusOptions: ReportStatus[] = ["RECEIVED", "IN_PROGRESS", "NEEDS_CLARIFICATION", "DONE"];

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, allUsers } = useAuth();
  const {
    reports,
    statusHistory,
    chatSessions,
    updateReportStatus,
    updateReportUrgency,
    updateReportNotes,
    createChatSession,
  } = useData();

  const report = reports.find((r) => r.id === id);
  const [newStatus, setNewStatus] = useState<ReportStatus | "">(report?.status ?? "");
  const [newUrgency, setNewUrgency] = useState<Urgency>(report?.urgency ?? "RENDAH");
  const [notes, setNotes] = useState(report?.admin_notes ?? "");
  const [statusNote, setStatusNote] = useState("");

  // hidden input used by tests to override urgency without interacting with Radix dropdown
  const hiddenUrgencyInput = (
    <input
      type="hidden"
      data-testid="urgency-hidden"
      value={newUrgency}
      onChange={(e) => setNewUrgency(e.target.value as Urgency)}
    />
  );

  if (!user || !report) {
    return (
      <div className="animate-fade-in text-center py-20">
        <p className="text-muted-foreground">Laporan tidak ditemukan.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/laporan")}>
          Kembali
        </Button>
      </div>
    );
  }

  const history = statusHistory
    .filter((h) => h.report_id === report.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const sender = allUsers.find((u) => u.id === report.user_id);
  const linkedChat = chatSessions.find(
    (cs) => cs.report_id === report.id && cs.status === "OPEN"
  );

  const handleUpdateStatus = async () => {
    if (!newStatus || newStatus === report.status) return;

    // Validation: can't skip to DONE from RECEIVED for TINGGI urgency
    if (report.urgency === "TINGGI" && report.status === "RECEIVED" && newStatus === "DONE") {
      toast({
        title: "Tidak Diperbolehkan",
        description: "Laporan urgensi Tinggi harus melewati status Dalam Proses sebelum diselesaikan.",
        variant: "destructive",
      });
      return;
    }

    await updateReportStatus(report.id, newStatus as ReportStatus, user.id, statusNote || undefined);

    // If NEEDS_CLARIFICATION, auto-create chat session
    if (newStatus === "NEEDS_CLARIFICATION" && !linkedChat) {
      await createChatSession(report.user_id, report.id);
    }

    toast({
      title: "Berhasil! ✅",
      description: `Status laporan diperbarui ke "${STATUS_LABELS[newStatus as ReportStatus]}"`,
    });
    setStatusNote("");
  };

  const handleSaveNotes = async () => {
    await updateReportNotes(report.id, notes);
    toast({ title: "Tersimpan ✅", description: "Catatan internal telah disimpan." });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {hiddenUrgencyInput}
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/laporan")} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Report Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Detail Laporan — {report.case_id}</CardTitle>
              <StatusBadge status={report.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Pengirim</p>
                <p className="font-medium">{sender?.name ?? "-"}</p>
                {sender && (
                  <p className="text-[10px] text-muted-foreground">{BIRO_LABELS[sender.biro]} · {JABATAN_LABELS[sender.jabatan]}</p>
                )}
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
                <p className="text-xs font-medium">{new Date(report.created_at).toLocaleString("id-ID")}</p>
              </div>
            </div>

            <div>
              <p className="text-muted-foreground text-xs mb-1">Kronologi</p>
              <p className="text-sm bg-muted p-3 rounded-lg">{report.kronologi}</p>
            </div>

            {/* Timeline */}
            <div>
              <p className="text-muted-foreground text-xs mb-2">Timeline Status</p>
              <div className="space-y-0">
                {history.map((h, i) => {
                  const changer = h.changed_by === "system"
                    ? "Sistem"
                    : allUsers.find((u) => u.id === h.changed_by)?.name ?? "Admin";
                  return (
                    <div key={h.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`h-3 w-3 rounded-full shrink-0 mt-1 ${
                          i === history.length - 1 ? "bg-primary" : "bg-border"
                        }`} />
                        {i < history.length - 1 && <div className="w-0.5 flex-1 bg-border" />}
                      </div>
                      <div className="pb-3">
                        <p className="text-xs font-medium">{STATUS_LABELS[h.new_status]}</p>
                        {h.note && <p className="text-[10px] text-muted-foreground">{h.note}</p>}
                        <p className="text-[10px] text-muted-foreground/70">
                          {changer} · {new Date(h.created_at).toLocaleString("id-ID")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Processing */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tindak Lanjut</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Ubah Urgensi</Label>
                <Select value={newUrgency} onValueChange={(v) => setNewUrgency(v as Urgency)}>
                  <SelectTrigger className="mt-1" aria-label="Ubah Urgensi">
                    <SelectValue placeholder={URGENCY_LABELS[report.urgency]} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(URGENCY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key} data-testid={`urgency-option-${key}`}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    if (!newUrgency || newUrgency === report.urgency) return;
                    void updateReportUrgency(report.id, newUrgency, user.id);
                    toast({
                      title: "Berhasil! ✅",
                      description: `Urgensi diperbarui ke "${URGENCY_LABELS[newUrgency as Urgency]}"`,
                    });
                  }}
                  className="w-full mt-2"
                  disabled={!newUrgency || newUrgency === report.urgency}
                >
                  Perbarui Urgensi
                </Button>
              </div>
              <div>
                <Label>Update Status</Label>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ReportStatus)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Catatan Perubahan Status</Label>
                <Textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="(opsional) Alasan perubahan status..."
                  className="mt-1 min-h-[60px]"
                />
              </div>

              <Button
                onClick={handleUpdateStatus}
                className="w-full"
                disabled={!newStatus || newStatus === report.status}
              >
                Perbarui Status
              </Button>

              {linkedChat && (
                <Button
                  variant="outline"
                  className="w-full gap-2 border-primary text-primary"
                  onClick={() => navigate(`/admin/chat`)}
                >
                  <MessageCircle className="h-4 w-4" />
                  Buka Chat Klarifikasi
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Catatan Internal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan ini hanya bisa dilihat oleh sesama Admin."
                className="min-h-[100px]"
              />
              <Button variant="outline" onClick={handleSaveNotes} className="w-full">
                Simpan Catatan
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
