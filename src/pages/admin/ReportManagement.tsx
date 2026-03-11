import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UrgencyBadge, StatusBadge } from "@/components/shared/StatusBadges";
import { mockReports } from "@/data/mockData";

export default function ReportManagement() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");

  const filtered = mockReports.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (urgencyFilter !== "all" && r.urgency !== urgencyFilter) return false;
    return true;
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
            <SelectItem value="Diterima">Diterima</SelectItem>
            <SelectItem value="Dalam Proses">Dalam Proses</SelectItem>
            <SelectItem value="Membutuhkan Klarifikasi">Membutuhkan Klarifikasi</SelectItem>
            <SelectItem value="Selesai">Selesai</SelectItem>
          </SelectContent>
        </Select>
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter Urgensi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Urgensi</SelectItem>
            <SelectItem value="Tinggi">Tinggi</SelectItem>
            <SelectItem value="Sedang">Sedang</SelectItem>
            <SelectItem value="Rendah">Rendah</SelectItem>
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
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.id}</TableCell>
                    <TableCell className="text-sm">{r.isAnonymous ? "Anonim" : r.sender}</TableCell>
                    <TableCell className="text-sm">{r.category}</TableCell>
                    <TableCell><UrgencyBadge urgency={r.urgency} /></TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.date}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/admin/laporan/${r.id}`)}>
                        Lihat Detail
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
