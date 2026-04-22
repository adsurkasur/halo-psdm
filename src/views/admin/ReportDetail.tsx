import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, MessageCircle, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UrgencyBadge, StatusBadge } from "@/components/shared/StatusBadges";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { downloadFileFromUrl, getTransformedPublicImageUrl, isImageResource, isVideoResource } from "@/lib/supabase-storage";
import { MediaViewerDialog } from "@/components/shared/MediaViewerDialog";
import { BIRO_LABELS, JABATAN_LABELS, CATEGORY_LABELS, STATUS_LABELS, URGENCY_LABELS, type ReportStatus, type Urgency } from "@/data/domain";
import { UserAvatarWithPreview } from "@/components/shared/UserAvatarWithPreview";

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
  const isImageAttachment = isImageResource(report.attachment_mime, report.attachment_name, report.attachment_url);
  const isVideoAttachment = isVideoResource(report.attachment_mime, report.attachment_name, report.attachment_url);
  const isPreviewableAttachment = isImageAttachment || isVideoAttachment;

  const formatAttachmentSize = (size?: number | null) => {
    if (!size) return "Ukuran tidak diketahui";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

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
                {sender ? (
                  <div className="mt-0.5 space-y-1">
                    <div className="flex items-center gap-2">
                      <UserAvatarWithPreview
                        name={sender.name}
                        avatarUrl={sender.avatar_url}
                        sizeClassName="h-8 w-8"
                        fallbackClassName="bg-primary text-primary-foreground text-[10px]"
                        modalTitle="Foto Profil Pengirim"
                      />
                      <p className="font-medium">{sender.name}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {BIRO_LABELS[sender.biro]} · {JABATAN_LABELS[sender.jabatan]}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{sender.email}</p>
                  </div>
                ) : (
                  <p className="font-medium">Identitas pengirim tidak ditemukan.</p>
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

            {report.attachment_url && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Lampiran</p>
                <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{report.attachment_name ?? "Lampiran"}</p>
                      <p className="text-xs text-muted-foreground">
                        {report.attachment_mime ?? "Tipe tidak diketahui"} · {formatAttachmentSize(report.attachment_size)}
                      </p>
                    </div>
                  </div>
                  {isPreviewableAttachment ? (
                    <MediaViewerDialog
                      mediaUrl={report.attachment_url}
                      mediaName={report.attachment_name}
                      mediaMime={report.attachment_mime}
                      title="Pratinjau Lampiran Laporan"
                    >
                        <div data-testid="admin-report-attachment-preview" className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                        <Download className="h-4 w-4" /> Lihat
                      </div>
                    </MediaViewerDialog>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 shrink-0"
                      onClick={async () => {
                        try {
                          await downloadFileFromUrl(
                            report.attachment_url!,
                            report.attachment_name ?? "lampiran",
                          );
                        } catch (error) {
                          toast({
                            title: error instanceof Error ? error.message : "Gagal mengunduh lampiran.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Download className="h-4 w-4" /> Download
                    </Button>
                  )}
                </div>
                {isImageAttachment && (
                  <MediaViewerDialog
                    mediaUrl={report.attachment_url}
                    mediaName={report.attachment_name}
                    mediaMime={report.attachment_mime}
                    title="Pratinjau Lampiran Laporan"
                    triggerClassName="mt-2"
                  >
                    <div className="rounded-md border bg-card p-2">
                      <img
                        src={getTransformedPublicImageUrl(report.attachment_url, {
                          width: 1360,
                          quality: 80,
                          resize: "contain",
                        })}
                        alt={report.attachment_name ?? "Lampiran gambar"}
                        className="w-full max-h-[360px] rounded object-contain"
                        loading="lazy"
                        onError={(e) => {
                          if (e.currentTarget.src !== report.attachment_url) {
                            e.currentTarget.src = report.attachment_url!;
                          }
                        }}
                      />
                    </div>
                  </MediaViewerDialog>
                )}

                {!isImageAttachment && isVideoAttachment && report.attachment_url && (
                  <MediaViewerDialog
                    mediaUrl={report.attachment_url}
                    mediaName={report.attachment_name}
                    mediaMime={report.attachment_mime}
                    title="Pratinjau Lampiran Video"
                    triggerClassName="mt-2"
                  >
                    <div className="rounded-md border bg-card p-2">
                      <video
                        src={report.attachment_url}
                        controls
                        preload="metadata"
                        className="w-full max-h-[360px] rounded bg-black"
                      >
                        Browser Anda tidak mendukung pemutar video.
                      </video>
                    </div>
                  </MediaViewerDialog>
                )}
              </div>
            )}

            {/* Timeline */}
            <div>
              <p className="text-muted-foreground text-xs mb-2">Timeline Status</p>
              <div className="space-y-0">
                {history.map((h, i) => {
                  const changer = h.changed_by === "system"
                    ? "Sistem"
                    : allUsers.find((u) => u.id === h.changed_by)?.name ?? "PH";
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
                  <SelectTrigger className="mt-1" data-testid="admin-report-status-trigger">
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
                data-testid="admin-report-update-status"
                onClick={handleUpdateStatus}
                className="w-full"
                disabled={!newStatus || newStatus === report.status}
              >
                Perbarui Status
              </Button>

              {linkedChat && (
                <Button
                  data-testid="admin-report-open-chat"
                  variant="outline"
                  className="w-full gap-2 border-primary text-primary"
                  onClick={() => navigate(`/admin/chat`)}
                >
                  <MessageCircle className="h-4 w-4" />
                  Buka Chat
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
                placeholder="Catatan ini hanya bisa dilihat oleh sesama PH."
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
