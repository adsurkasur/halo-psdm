import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/contexts/DataContext";
import { mockUsers, AVAILABILITY_LABELS, type AvailabilityStatus } from "@/data/mockData";

export default function AdminManagement() {
  const { adminProfiles, updateAvailability } = useData();

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold">Kelola Admin</h1>
      <p className="text-sm text-muted-foreground">
        Kelola profil dan ketersediaan admin PSDM. Hanya Super Admin yang dapat mengakses halaman ini.
      </p>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead>No. WhatsApp</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminProfiles.map((profile) => {
                const adminUser = mockUsers.find((u) => u.id === profile.user_id);
                const initials = profile.display_name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <TableRow key={profile.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{profile.display_name}</p>
                          <p className="text-[10px] text-muted-foreground">{adminUser?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{profile.jabatan_display}</TableCell>
                    <TableCell className="text-sm font-mono">+{profile.wa_number}</TableCell>
                    <TableCell>
                      <Select
                        value={profile.availability_status}
                        onValueChange={(v) =>
                          updateAvailability(profile.user_id, v as AvailabilityStatus)
                        }
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ONLINE">🟢 Online</SelectItem>
                          <SelectItem value="AWAY">🟡 Sibuk</SelectItem>
                          <SelectItem value="OFFLINE">⚫ Offline</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
