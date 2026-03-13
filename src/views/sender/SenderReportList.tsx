import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { UrgencyBadge, StatusBadge } from "@/components/shared/StatusBadges";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { CATEGORY_LABELS } from "@/data/mockData";

export default function SenderReportList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { reports } = useData();

  if (!user) return null;

  const myReports = reports.filter((r) => r.user_id === user.id);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Laporan Saya</h1>
        <Button className="gap-2" onClick={() => navigate("/laporan/buat")}>
          <Plus className="h-4 w-4" />
          Buat Laporan
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {myReports.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">Anda belum memiliki laporan.</p>
              <Button className="mt-4" onClick={() => navigate("/laporan/buat")}>
                Buat Laporan Pertama
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Kasus</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Urgensi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myReports.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/laporan/${r.id}`)}
                    >
                      <TableCell className="font-mono text-xs">{r.case_id}</TableCell>
                      <TableCell className="text-sm">{CATEGORY_LABELS[r.category]}</TableCell>
                      <TableCell><UrgencyBadge urgency={r.urgency} /></TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("id-ID")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
