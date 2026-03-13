import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  AVAILABILITY_LABELS,
  JABATAN_LABELS,
  type UserRole,
} from "@/data/domain";
import { Input } from "@/components/ui/input";

export default function AdminManagement() {
  const { adminProfiles, updateAvailability, addAdminProfile, removeAdminProfile } = useData();
  const { allUsers, changeUserRole } = useAuth();

  const [newAdminId, setNewAdminId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold">Kelola Admin</h1>
      <p className="text-sm text-muted-foreground">
        Kelola profil dan ketersediaan admin PSDM. Hanya Super Admin yang dapat mengakses halaman ini.
      </p>

      {/* add admin form (single searchable bar) */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="relative w-full max-w-md">
            <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Cari atau pilih pengirim..."
                value={addSearch}
                onChange={(e) => {
                  setAddSearch(e.target.value);
                  setNewAdminId("");
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                className="w-full"
              />
              {showDropdown && (
                <div className="absolute z-20 mt-1 w-full bg-background border border-input max-h-60 overflow-auto">
                  {allUsers
                    .filter(
                      (u) =>
                        u.role === "SENDER" &&
                        (u.name.toLowerCase().includes(addSearch.toLowerCase()) ||
                          u.email.toLowerCase().includes(addSearch.toLowerCase()))
                    )
                    .map((u) => (
                      <div
                        key={u.id}
                        className="px-3 py-2 hover:bg-muted cursor-pointer"
                        onMouseDown={() => {
                          setNewAdminId(u.id);
                          setAddSearch(`${u.name} (${u.email})`);
                        }}
                      >
                        {u.name} ({u.email})
                      </div>
                    ))}
                  {allUsers.filter((u) => u.role === "SENDER").length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Tidak ada pengirim
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button
              disabled={!newAdminId}
              onClick={async () => {
                const user = allUsers.find((u) => u.id === newAdminId);
                if (user) {
                  await changeUserRole(user.id, "ADMIN");
                  await addAdminProfile({
                    user_id: user.id,
                    display_name: user.name,
                    jabatan_display: JABATAN_LABELS[user.jabatan],
                    availability_status: "OFFLINE",
                    wa_number: "",
                    avatar_url: "",
                  });
                  setNewAdminId("");
                  setAddSearch("");
                }
              }}
            >
              Tambah Admin
            </Button>
          </div>
        </div>  
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div>
            <label className="sr-only" htmlFor="admin-search">
              Cari admin
            </label>
            <Input
              id="admin-search"
              placeholder="Cari admin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-sm"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>No. WhatsApp</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminProfiles
                .filter((profile) => {
                  const u = allUsers.find((u) => u.id === profile.user_id);
                  if (!u) return false;
                  const term = search.toLowerCase();
                  return (
                    u.name.toLowerCase().includes(term) ||
                    u.email.toLowerCase().includes(term)
                  );
                })
                .map((profile) => {
                const adminUser = allUsers.find((u) => u.id === profile.user_id);
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
                          <p className="text-sm font-medium">
                            {profile.display_name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {adminUser?.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {adminUser
                        ? JABATAN_LABELS[adminUser.jabatan]
                        : profile.jabatan_display}
                    </TableCell>
                    <TableCell>
                      {adminUser && (
                        <Select
                          value={adminUser.role}
                          onValueChange={async (v) => {
                            const newRole = v as UserRole;
                            await changeUserRole(adminUser.id, newRole);
                            if (newRole === "SENDER") {
                              await removeAdminProfile(adminUser.id);
                            } else {
                              // ensure profile exists
                              if (
                                !adminProfiles.find((p) => p.user_id === adminUser.id)
                              ) {
                                await addAdminProfile({
                                  user_id: adminUser.id,
                                  display_name: adminUser.name,
                                  jabatan_display: JABATAN_LABELS[adminUser.jabatan],
                                  availability_status: "OFFLINE",
                                  wa_number: "",
                                  avatar_url: "",
                                });
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="w-[120px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SENDER">Sender</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="SUPER_ADMIN">
                              Super Admin
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      +{profile.wa_number}
                    </TableCell>
                    <TableCell className="text-sm flex items-center gap-1">
                      {profile.availability_status === "ONLINE" ? "🟢" : profile.availability_status === "AWAY" ? "🟡" : "⚫"}
                      {AVAILABILITY_LABELS[profile.availability_status]}
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
