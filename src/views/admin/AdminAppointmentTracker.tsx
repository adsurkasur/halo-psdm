import { useMemo, useState } from "react";
import { CalendarCheck2, CheckCircle2, XCircle, Clock3, User, Mail, MessageSquare, Plus, Loader2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/data/domain";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function AdminAppointmentTracker() {
  const { appointments, updateAppointmentStatus, addAppointment, adminProfiles } = useData();
  const { allUsers } = useAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "ALL">("ALL");
  const [statusNote, setStatusNote] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // States for manual entry
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualUserId, setManualUserId] = useState("");
  const [manualTargetAdminId, setManualTargetAdminId] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualStatus, setManualStatus] = useState<AppointmentStatus>("OPEN");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const sortedAppointments = useMemo(() => {
    const statusRank: Record<AppointmentStatus, number> = {
      OPEN: 4,
      VERIFIED: 3,
      DONE: 2,
      DISMISSED: 1,
    };

    return appointments
      .filter((appointment) => (statusFilter === "ALL" ? true : appointment.status === statusFilter))
      .sort((a, b) => {
        const rankDiff = statusRank[b.status] - statusRank[a.status];
        if (rankDiff !== 0) return rankDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [appointments, statusFilter]);

  const summary = {
    all: appointments.length,
    open: appointments.filter((a) => a.status === "OPEN").length,
    verified: appointments.filter((a) => a.status === "VERIFIED").length,
    done: appointments.filter((a) => a.status === "DONE").length,
    dismissed: appointments.filter((a) => a.status === "DISMISSED").length,
  };

  const handleUpdate = async (appointmentId: string, nextStatus: AppointmentStatus) => {
    setUpdatingId(appointmentId);
    try {
      await updateAppointmentStatus(appointmentId, nextStatus, statusNote[appointmentId]);
      setStatusNote((prev) => ({ ...prev, [appointmentId]: "" }));
      toast({
        title: "Status janji temu diperbarui",
        description: `Status diubah menjadi ${APPOINTMENT_STATUS_LABELS[nextStatus]}.`,
      });
    } catch (error) {
      toast({
        title: "Gagal memperbarui janji temu",
        description: error instanceof Error ? error.message : "Coba lagi beberapa saat.",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCreateManual = async () => {
    if (!manualUserId) {
      toast({ title: "Pilih pengaju (user) terlebih dahulu.", variant: "destructive" });
      return;
    }
    if (!manualTargetAdminId) {
      toast({ title: "Pilih penerima (admin) terlebih dahulu.", variant: "destructive" });
      return;
    }

    setIsSubmittingManual(true);
    try {
      // 1. Create appointment request
      const appt = await addAppointment(manualUserId, manualTargetAdminId);
      
      // 2. If status is not OPEN or custom note is present, update status
      if (manualStatus !== "OPEN" || manualNote.trim()) {
        await updateAppointmentStatus(appt.id, manualStatus, manualNote);
      }

      toast({
        title: "Janji Temu Manual Dibuat",
        description: "Janji temu luar aplikasi berhasil dicatat.",
      });

      // Clear states & close modal
      setManualUserId("");
      setManualTargetAdminId("");
      setManualNote("");
      setManualStatus("OPEN");
      setIsManualOpen(false);
    } catch (error) {
      toast({
        title: "Gagal membuat janji temu",
        description: error instanceof Error ? error.message : "Terjadi kesalahan.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingManual(false);
    }
  };

  return (
    <div className="space-y-6 page-enter">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-8 text-primary-foreground shadow-lg shadow-primary/10">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold">Tracking Janji Temu</h1>
          <p className="mt-1 text-primary-foreground/80 text-sm font-medium">
            Kelola jadwal dan status pertemuan dengan anggota.
          </p>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8 animate-float" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as AppointmentStatus | "ALL")}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full grid-cols-5 sm:w-auto">
              <TabsTrigger value="ALL" className="text-xs px-2.5">Semua</TabsTrigger>
              <TabsTrigger value="OPEN" className="text-xs px-2.5">Menunggu Verifikasi</TabsTrigger>
              <TabsTrigger value="VERIFIED" className="text-xs px-2.5">Disetujui</TabsTrigger>
              <TabsTrigger value="DONE" className="text-xs px-2.5">Selesai</TabsTrigger>
              <TabsTrigger value="DISMISSED" className="text-xs px-2.5">Ditolak</TabsTrigger>
            </TabsList>
          </Tabs>

          <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 text-xs h-9">
                <Plus className="h-4 w-4" />
                Janji Temu Manual
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Tambah Janji Temu Manual</DialogTitle>
                <DialogDescription>
                  Catat pertemuan yang dijadwalkan di luar aplikasi.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label>Pengaju (User / Anggota)</Label>
                  <Select value={manualUserId} onValueChange={setManualUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih anggota..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Penerima (Admin / HR / PH)</Label>
                  <Select value={manualTargetAdminId} onValueChange={setManualTargetAdminId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih HR/PH..." />
                    </SelectTrigger>
                    <SelectContent>
                      {adminProfiles.map((ap) => (
                        <SelectItem key={ap.user_id} value={ap.user_id}>
                          {ap.display_name} ({ap.jabatan_display})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Status Awal</Label>
                  <Select value={manualStatus} onValueChange={(v) => setManualStatus(v as AppointmentStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Menunggu Verifikasi</SelectItem>
                      <SelectItem value="VERIFIED">Diverifikasi / Disetujui</SelectItem>
                      <SelectItem value="DONE">Selesai</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Catatan Tindak Lanjut</Label>
                  <Textarea
                    placeholder="Masukkan catatan (misal: Pertemuan luar aplikasi via Zoom...)"
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsManualOpen(false)}>
                  Batal
                </Button>
                <Button disabled={isSubmittingManual} onClick={handleCreateManual}>
                  {isSubmittingManual ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Janji Temu"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/50">
          <Clock3 className="h-3.5 w-3.5" />
          <span>Update otomatis aktif</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Pengajuan", value: summary.all, icon: CalendarCheck2, color: "text-primary", bg: "bg-primary/10" },
          { label: "Menunggu Verifikasi", value: summary.open, icon: Clock3, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Disetujui / Terjadwal", value: summary.verified, icon: Check, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Selesai Diproses", value: summary.done, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Ditolak / Dibatalkan", value: summary.dismissed, icon: XCircle, color: "text-rose-600", bg: "bg-rose-50" },
        ].map((stat, i) => (
          <Card key={i} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-0">
              <div className="flex items-center p-4 gap-4">
                <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                </div>
              </div>
              <div className={`h-1 w-full ${stat.color.replace('text', 'bg').replace('-600', '-500')} opacity-20`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Janji Temu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pengaju</TableHead>
                  <TableHead>Penerima</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Waktu Ajukan</TableHead>
                  <TableHead>Waktu Tindak Lanjut</TableHead>
                  <TableHead className="min-w-[280px]">Tindak Lanjut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAppointments.map((appointment) => {
                  const sender = appointment.user_id ? allUsers.find((u) => u.id === appointment.user_id) : undefined;
                  const target = appointment.target_admin_id ? allUsers.find((u) => u.id === appointment.target_admin_id) : undefined;
                  const isOpen = appointment.status === "OPEN" || appointment.status === "VERIFIED";
                  const isLoading = updatingId === appointment.id;

                  return (
                    <TableRow key={appointment.id} data-testid={`appointment-row-${appointment.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold">{sender?.name ?? (!appointment.user_id ? "Pengaju (Dihapus)" : "-")}</p>
                              {!appointment.user_id && (
                                <span className="inline-flex items-center rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] font-medium text-destructive">
                                  Dihapus
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                              <Mail className="h-2.5 w-2.5" />
                              {sender?.email ?? (!appointment.user_id ? "Akun telah dihapus" : "")}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{target?.name ?? "-"}</p>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                              <Mail className="h-2.5 w-2.5" />
                              {target?.email ?? ""}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            appointment.status === "OPEN"
                              ? "bg-amber-100 text-amber-700 border border-amber-200"
                              : appointment.status === "VERIFIED"
                                ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                                : appointment.status === "DONE"
                                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                  : "bg-rose-100 text-rose-700 border border-rose-200"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            appointment.status === "OPEN"
                              ? "bg-amber-500"
                              : appointment.status === "VERIFIED"
                                ? "bg-indigo-500"
                                : appointment.status === "DONE"
                                  ? "bg-emerald-500"
                                  : "bg-rose-500"
                          }`} />
                          {APPOINTMENT_STATUS_LABELS[appointment.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(appointment.created_at).toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {appointment.handled_at
                          ? new Date(appointment.handled_at).toLocaleString("id-ID")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {isOpen ? (
                          <div className="space-y-3 py-2">
                            <div className="relative">
                              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Catatan Tindak Lanjut</Label>
                              <Textarea
                                data-testid={`appointment-note-${appointment.id}`}
                                value={statusNote[appointment.id] ?? ""}
                                onChange={(event) =>
                                  setStatusNote((prev) => ({
                                    ...prev,
                                    [appointment.id]: event.target.value,
                                  }))
                                }
                                className="mt-1 min-h-[70px] text-xs resize-none bg-muted/30 focus-visible:ring-primary/30"
                                placeholder="Misal: Sudah dihubungi via WhatsApp..."
                              />
                            </div>
                            <div className="flex gap-2">
                              {appointment.status === "OPEN" ? (
                                <Button
                                  data-testid={`appointment-verify-${appointment.id}`}
                                  size="sm"
                                  className="h-8 px-4 font-semibold shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white"
                                  disabled={isLoading}
                                  onClick={() => void handleUpdate(appointment.id, "VERIFIED")}
                                >
                                  <Check className="mr-1.5 h-3.5 w-3.5" />
                                  Verifikasi
                                </Button>
                              ) : (
                                <Button
                                  data-testid={`appointment-done-${appointment.id}`}
                                  size="sm"
                                  className="h-8 px-4 font-semibold shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                                  disabled={isLoading}
                                  onClick={() => void handleUpdate(appointment.id, "DONE")}
                                >
                                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                  Selesaikan
                                </Button>
                              )}
                              <Button
                                data-testid={`appointment-dismiss-${appointment.id}`}
                                size="sm"
                                variant="outline"
                                className="h-8 px-4 font-semibold border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                disabled={isLoading}
                                onClick={() => void handleUpdate(appointment.id, "DISMISSED")}
                              >
                                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                                Tolak
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 py-2">
                            <div className="mt-0.5 p-1 rounded bg-muted">
                              <MessageSquare className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <p className="text-xs text-muted-foreground italic leading-relaxed">
                              {appointment.status_note?.trim() || "Tidak ada catatan tindak lanjut"}
                            </p>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {sortedAppointments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-sm text-muted-foreground">
                      Belum ada data janji temu.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
