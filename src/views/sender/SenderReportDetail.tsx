import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, MessageCircle, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UrgencyBadge, StatusBadge } from "@/components/shared/StatusBadges";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { getTransformedPublicImageUrl, isImageResource, isVideoResource } from "@/lib/supabase-storage";
import { MediaViewerDialog } from "@/components/shared/MediaViewerDialog";
import { CATEGORY_LABELS, STATUS_LABELS, BIRO_LABELS } from "@/data/domain";

export default function SenderReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, allUsers } = useAuth();
  const { reports, statusHistory, chatSessions, createChatSession } = useData();

  if (!user) return null;

  const report = reports.find((r) => r.id === id);
  if (!report) {
    return (
      <div className="page-enter text-center py-20">
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

  const reportChats = chatSessions
    .filter((cs) => cs.report_id === report.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const linkedChat = reportChats.find((cs) => cs.status === "OPEN") ?? reportChats[0] ?? null;
  const isImageAttachment = isImageResource(report.attachment_mime, report.attachment_name, report.attachment_url);
  const isVideoAttachment = isVideoResource(report.attachment_mime, report.attachment_name, report.attachment_url);
  const isPreviewableAttachment = isImageAttachment || isVideoAttachment;

  const senderUser = allUsers.find((u) => u.id === report.user_id);
  const formatAttachmentSize = (size?: number | null) => {
    if (!size) return "Ukuran tidak diketahui";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div data-testid="sender-report-detail" className="space-y-4 page-enter max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/laporan")} className="gap-1 transition-transform duration-200 hover:scale-105">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Button>

      {/* Report Info */}
      <Card className="animate-scale-in">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Detail Laporan — {report.case_id}</CardTitle>
            <StatusBadge status={report.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm stagger-children">
            <div>
              <p className="text-muted-foreground text-xs">Pengirim</p>
              <p className="font-medium">{senderUser?.name ?? "-"}</p>
              {senderUser && <p className="text-[10px] text-muted-foreground">{BIRO_LABELS[senderUser.biro]}</p>}
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

          <div className="animate-slide-up" style={{ animationDelay: "200ms" }}>
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
                    <div data-testid="sender-report-attachment-preview" className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                      <Download className="h-4 w-4" /> Lihat
                    </div>
                  </MediaViewerDialog>
                ) : (
                  <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
                    <a href={report.attachment_url} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" /> Buka
                    </a>
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

          <Button
            data-testid="sender-report-open-chat"
            variant="outline"
            className="w-full gap-2 border-primary text-primary transition-all duration-200 hover:shadow-md"
            onClick={async () => {
              if (linkedChat) {
                navigate(`/chat/${linkedChat.id}`);
                return;
              }

              const session = await createChatSession(user.id, report.id);
              navigate(`/chat/${session.id}`);
            }}
          >
            <MessageCircle className="h-4 w-4" />
            Buka Chat
          </Button>
        </CardContent>
      </Card>

      {/* Status Timeline */}
      <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
        <CardHeader>
          <CardTitle className="text-base">Timeline Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {history.map((h, i) => {
              const changer = h.changed_by === "system"
                ? "Sistem"
                : allUsers.find((u) => u.id === h.changed_by)?.name ?? "PH";
              return (
                <div key={h.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`h-3 w-3 rounded-full shrink-0 mt-1 transition-all duration-300 ${
                      i === history.length - 1 ? "bg-primary animate-pulse-glow" : "bg-border"
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
