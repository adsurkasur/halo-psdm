import { useMemo, useState } from "react";
import { CalendarCheck2, CheckCircle2, XCircle, Clock3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/data/domain";
import { useToast } from "@/hooks/use-toast";

export default function AdminAppointmentTracker() {
  const { appointments, updateAppointmentStatus } = useData();
  const { allUsers } = useAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "ALL">("ALL");
  const [statusNote, setStatusNote] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const sortedAppointments = useMemo(() => {
    const statusRank: Record<AppointmentStatus, number> = {
      OPEN: 3,
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Tracking Janji Temu</h1>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AppointmentStatus | "ALL")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Status</SelectItem>
            <SelectItem value="OPEN">Aktif</SelectItem>
            <SelectItem value="DONE">Selesai</SelectItem>
            <SelectItem value="DISMISSED">Ditolak</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <CalendarCheck2 className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xl font-bold">{summary.all}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <Clock3 className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-xl font-bold">{summary.open}</p>
              <p className="text-xs text-muted-foreground">Aktif</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xl font-bold">{summary.done}</p>
              <p className="text-xs text-muted-foreground">Selesai</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-rose-600" />
            <div>
              <p className="text-xl font-bold">{summary.dismissed}</p>
              <p className="text-xs text-muted-foreground">Ditolak</p>
            </div>
          </CardContent>
        </Card>
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
                  const sender = allUsers.find((u) => u.id === appointment.user_id);
                  const target = allUsers.find((u) => u.id === appointment.target_admin_id);
                  const isOpen = appointment.status === "OPEN";
                  const isLoading = updatingId === appointment.id;

                  return (
                    <TableRow key={appointment.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{sender?.name ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{sender?.email ?? ""}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{target?.name ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{target?.email ?? ""}</p>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${
                            appointment.status === "OPEN"
                              ? "bg-yellow-100 text-yellow-800"
                              : appointment.status === "DONE"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                          }`}
                        >
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
                          <div className="space-y-2">
                            <div>
                              <Label className="text-[11px]">Catatan (opsional)</Label>
                              <Textarea
                                value={statusNote[appointment.id] ?? ""}
                                onChange={(event) =>
                                  setStatusNote((prev) => ({
                                    ...prev,
                                    [appointment.id]: event.target.value,
                                  }))
                                }
                                className="mt-1 min-h-[56px] text-xs"
                                placeholder="Tambahkan catatan tindak lanjut..."
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="h-8"
                                disabled={isLoading}
                                onClick={() => void handleUpdate(appointment.id, "DONE")}
                              >
                                Done
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-rose-500 text-rose-600"
                                disabled={isLoading}
                                onClick={() => void handleUpdate(appointment.id, "DISMISSED")}
                              >
                                Dismiss
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {appointment.status_note?.trim() || "Tidak ada catatan"}
                          </p>
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
