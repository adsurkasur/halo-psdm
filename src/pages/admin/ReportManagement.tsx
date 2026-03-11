import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UrgencyBadge, StatusBadge } from "@/components/shared/StatusBadges";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORY_LABELS, type Urgency } from "@/data/mockData";

export default function ReportManagement() {
  const navigate = useNavigate();
  const { reports } = useData();
  const { allUsers } = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");

  const filtered = reports
    .filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (urgencyFilter !== "all" && r.urgency !== urgencyFilter) return false;
      return true;
    })
    .sort((a, b) => {
      // Sort by urgency DESC
      const urgencyOrder: Record<Urgency, number> = { TINGGI: 3, SEDANG: 2, RENDAH: 1 };
      const urgDiff = urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
      if (urgDiff !== 0) return urgDiff;
      // Then by created_at ASC (oldest first)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold">Kelola Laporan</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="RECEIVED">Diterima</SelectItem>
            <SelectItem value="IN_PROGRESS">Dalam Proses</SelectItem>
            <SelectItem value="NEEDS_CLARIFICATION">Membutuhkan Klarifikasi</SelectItem>
            <SelectItem value="DONE">Selesai</SelectItem>
          </SelectContent>
        </Select>
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter Urgensi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Urgensi</SelectItem>
            <SelectItem value="TINGGI">Tinggi</SelectItem>
            <SelectItem value="SEDANG">Sedang</SelectItem>
            <SelectItem value="RENDAH">Rendah</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Kasus</TableHead>
                  <TableHead>Pengirim</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Urgensi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const sender = allUsers.find((u) => u.id === r.user_id);
                  return (
                    <TableRow key={r.id} className="transition-colors duration-200">
                      <TableCell className="font-mono text-xs">{r.case_id}</TableCell>
                      <TableCell className="text-sm">
                        {sender?.name ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm">{CATEGORY_LABELS[r.category]}</TableCell>
                      <TableCell><UrgencyBadge urgency={r.urgency} /></TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("id-ID")}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="transition-all duration-200 hover:shadow-sm" onClick={() => navigate(`/admin/laporan/${r.id}`)}>
                          Lihat Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Tidak ada laporan yang sesuai filter.
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
