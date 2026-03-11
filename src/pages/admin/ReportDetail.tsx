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
import { mockReports } from "@/data/mockData";

const statusOptions = ["Diterima", "Dalam Proses", "Membutuhkan Klarifikasi", "Selesai"];

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const report = mockReports.find((r) => r.id === id) || mockReports[0];
  const [status, setStatus] = useState(report.status);
  const [notes, setNotes] = useState("");

  const handleUpdate = () => {
    toast({ title: "Berhasil! ✅", description: `Status laporan ${report.id} diperbarui menjadi "${status}"` });
  };

  const timeline = [
    { label: "Diterima", date: report.date, active: true },
    { label: "Dalam Proses", date: status === "Dalam Proses" || status === "Membutuhkan Klarifikasi" || status === "Selesai" ? report.date : null, active: status !== "Diterima" },
    { label: "Selesai", date: status === "Selesai" ? report.date : null, active: status === "Selesai" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/laporan")} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Report Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detail Laporan — {report.id}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Pengirim</p>
                <p className="font-medium">{report.isAnonymous ? "Anonim" : report.sender}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Kategori</p>
                <p className="font-medium">{report.category}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Urgensi</p>
                <UrgencyBadge urgency={report.urgency} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <StatusBadge status={status} />
              </div>
            </div>

            <div>
              <p className="text-muted-foreground text-xs mb-1">Kronologi</p>
              <p className="text-sm bg-muted p-3 rounded-lg">{report.chronology}</p>
            </div>

            {/* Timeline */}
            <div>
              <p className="text-muted-foreground text-xs mb-2">Timeline</p>
              <div className="flex items-center gap-0">
                {timeline.map((step, i) => (
                  <div key={step.label} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className={`h-3 w-3 rounded-full ${step.active ? "bg-primary" : "bg-border"}`} />
                      <p className={`text-[10px] mt-1 ${step.active ? "text-primary font-medium" : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                    </div>
                    {i < timeline.length - 1 && (
                      <div className={`h-0.5 w-12 mx-1 ${step.active && timeline[i + 1].active ? "bg-primary" : "bg-border"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Processing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tindak Lanjut</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Update Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Catatan Internal</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan ini hanya bisa dilihat oleh sesama Admin."
                className="mt-1 min-h-[100px]"
              />
            </div>

            <Button onClick={handleUpdate} className="w-full">Simpan Perubahan</Button>

            {status === "Membutuhkan Klarifikasi" && (
              <Button
                variant="outline"
                className="w-full gap-2 border-primary text-primary"
                onClick={() => navigate("/admin/chat")}
              >
                <MessageCircle className="h-4 w-4" />
                Buka Sesi Chat dengan Pengirim
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
