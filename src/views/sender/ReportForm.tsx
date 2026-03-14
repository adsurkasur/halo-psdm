import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Paperclip, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { supabase } from "@/lib/supabase/client";
import { compressImageForUpload, isCompressibleImage } from "@/lib/upload-compression";
import { CATEGORY_LABELS, BIRO_LABELS, JABATAN_LABELS, type ReportCategory, type Urgency } from "@/data/domain";

const categories = Object.entries(CATEGORY_LABELS) as [ReportCategory, string][];
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

interface ReportFormProps {
  initialCategory?: ReportCategory | "";
  initialChronology?: string;
}

export default function ReportForm({
  initialCategory = "",
  initialChronology = "",
}: ReportFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { addReport } = useData();

  const [category, setCategory] = useState<ReportCategory | "">(initialCategory);
  const [urgency, setUrgency] = useState<Urgency>("RENDAH");
  const [chronology, setChronology] = useState(initialChronology);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // give more specific feedback rather than a catchall message
    if (!category) {
      toast({
        title: "Peringatan",
        description: "Mohon pilih kategori laporan.",
        variant: "destructive",
      });
      return;
    }
    if (chronology.length < 50) {
      toast({
        title: "Peringatan",
        description: "Kronologi minimal 50 karakter.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      let uploadAttachment = attachment;
      if (uploadAttachment && isCompressibleImage(uploadAttachment)) {
        try {
          const optimized = await compressImageForUpload(uploadAttachment, "attachment");
          uploadAttachment = optimized.file;

          if (optimized.compressed) {
            toast({
              title: "Lampiran gambar dioptimalkan",
              description: `${formatBytes(optimized.originalSize)} -> ${formatBytes(optimized.compressedSize)}`,
            });
          }
        } catch {
          toast({
            title: "Kompresi gambar dilewati",
            description: "File asli tetap digunakan untuk menjaga proses upload tetap berjalan.",
          });
        }
      }

      if (uploadAttachment && uploadAttachment.size > MAX_ATTACHMENT_SIZE) {
        toast({
          title: "Peringatan",
          description: "Ukuran attachment maksimal 10MB.",
          variant: "destructive",
        });
        return;
      }

      let attachmentPayload:
        | {
            attachment_url: string;
            attachment_name: string;
            attachment_path: string;
            attachment_mime: string;
            attachment_size: number;
          }
        | undefined;

      if (uploadAttachment) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
        }

        const formData = new FormData();
        formData.append("attachment", uploadAttachment);

        const response = await fetch("/api/secure/reports/attachments", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        });

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          attachment_url?: string;
          attachment_name?: string;
          attachment_path?: string;
          attachment_mime?: string;
          attachment_size?: number;
        };

        if (!response.ok || !payload.attachment_url || !payload.attachment_path) {
          throw new Error(payload.error ?? "Upload attachment gagal.");
        }

        attachmentPayload = {
          attachment_url: payload.attachment_url,
          attachment_name: payload.attachment_name ?? uploadAttachment.name,
          attachment_path: payload.attachment_path,
          attachment_mime: payload.attachment_mime ?? uploadAttachment.type ?? "application/octet-stream",
          attachment_size: payload.attachment_size ?? uploadAttachment.size,
        };
      }

      const report = await addReport({
        user_id: user.id,
        category: category as ReportCategory,
        urgency,
        kronologi: chronology,
        ...(attachmentPayload ?? {}),
      });

      toast({
        title: "Berhasil! ✅",
        description: `Laporan berhasil dikirim dengan ID: ${report.case_id}`,
      });

      setTimeout(() => navigate(`/laporan/${report.id}`), 800);
    } catch (error) {
      toast({
        title: "Gagal",
        description: error instanceof Error ? error.message : "Laporan gagal dikirim. Periksa koneksi Supabase lalu coba lagi.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-2xl mx-auto page-enter">
      <Card className="animate-scale-in">
        <CardHeader>
          <CardTitle>Buat Laporan / Pengaduan</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Identity — always shown, read-only */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-muted rounded-lg animate-slide-up">
              <div>
                <Label className="text-xs text-muted-foreground">Nama</Label>
                <Input value={user.name} readOnly className="mt-1 bg-card" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Biro/Bidang</Label>
                <Input value={BIRO_LABELS[user.biro]} readOnly className="mt-1 bg-card" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Jabatan</Label>
                <Input value={JABATAN_LABELS[user.jabatan]} readOnly className="mt-1 bg-card" />
              </div>
            </div>

            <p className="text-xs text-muted-foreground bg-accent/50 p-2.5 rounded-lg">
              ℹ️ Identitas Anda akan tercatat dalam laporan ini. Semua laporan bersifat <strong>confidential</strong> dan hanya bisa diakses oleh admin PSDM.
            </p>

            {/* Category */}
            <div>
              <Label>Kategori Masalah</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ReportCategory)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih kategori..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Urgency */}
            <div>
              <Label>Tingkat Urgensi</Label>
              <RadioGroup value={urgency} onValueChange={(v) => setUrgency(v as Urgency)} className="flex gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="RENDAH" id="low" />
                  <Label htmlFor="low" className="text-green-600 font-medium cursor-pointer">Rendah</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="SEDANG" id="med" />
                  <Label htmlFor="med" className="text-yellow-600 font-medium cursor-pointer">Sedang</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="TINGGI" id="high" />
                  <Label htmlFor="high" className="text-destructive font-medium cursor-pointer">Tinggi</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Chronology */}
            <div>
              <Label>Kronologi Permasalahan</Label>
              <Textarea
                value={chronology}
                onChange={(e) => setChronology(e.target.value)}
                placeholder="Ceritakan detail permasalahan yang Anda alami (min. 50 karakter)..."
                className="mt-1 min-h-[120px]"
              />
              <p className={`text-xs mt-1 transition-colors duration-300 ${chronology.length >= 50 ? "text-green-600" : "text-muted-foreground"}`}>
                {chronology.length}/50 karakter minimum
              </p>
            </div>

            {/* Attachment */}
            <div>
              <Label>Lampiran (opsional)</Label>
              <Input
                type="file"
                className="mt-1"
                onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: PDF, DOCX, XLSX, PNG, JPG, WEBP. Maksimal 10MB.
              </p>

              {attachment && (
                <div className="mt-2 flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="h-4 w-4 shrink-0" />
                    <span className="truncate">{attachment.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">({formatBytes(attachment.size)})</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setAttachment(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 text-base font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-primary/30"
            >
              {submitting ? "Mengirim..." : "Kirim Laporan"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
