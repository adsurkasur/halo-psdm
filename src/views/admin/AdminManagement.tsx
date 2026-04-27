import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";
import { isValidPhone62, normalizePhoneTo62 } from "@/lib/phone";
import { UserAvatarWithPreview } from "@/components/shared/UserAvatarWithPreview";

export default function AdminManagement() {
  const { adminProfiles, addAdminProfile, removeAdminProfile, getEffectiveStatus } = useData();
  const { user, allUsers, changeUserRole } = useAuth();
  const { toast } = useToast();

  const [newAdminId, setNewAdminId] = useState<string>("");
  const [newElevatedRole, setNewElevatedRole] = useState<"HR" | "PH">("HR");
  const [search, setSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const ensureDirectoryProfile = async (target: {
    id: string;
    name: string;
    jabatan: keyof typeof JABATAN_LABELS;
    wa_number?: string | null;
    avatar_url?: string | null;
  }) => {
    const normalizedPhone = normalizePhoneTo62(target.wa_number ?? "");
    if (!isValidPhone62(normalizedPhone)) {
      toast({
        title: "Nomor HP belum valid",
        description: "Isi nomor HP profil dengan kode negara (contoh: 628... atau 1...) terlebih dahulu.",
        variant: "destructive",
      });
      return false;
    }

    const existingProfile = adminProfiles.find((p) => p.user_id === target.id);
    await addAdminProfile({
      user_id: target.id,
      display_name: target.name,
      jabatan_display: JABATAN_LABELS[target.jabatan],
      availability_status: existingProfile?.availability_status ?? "OFFLINE",
      wa_number: normalizedPhone,
      avatar_url: target.avatar_url ?? "",
      last_seen_at: existingProfile?.last_seen_at ?? new Date(0).toISOString(),
      updated_at: new Date().toISOString(),
    });
    return true;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold">Kelola HR dan PH</h1>
      <p className="text-sm text-muted-foreground">
        Kelola role dan ketersediaan penerima janji temu PSDM (HR/PH). Hanya PH yang dapat mengakses halaman ini.
      </p>

      {user?.role === "PH" && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-medium">Status Saya di Daftar Janji Temu</p>
                <p className="text-sm text-muted-foreground">
                  PH memiliki hak HR untuk dicantumkan sebagai penerima janji temu.
                </p>
              </div>
              <Button
                variant={adminProfiles.some((p) => p.user_id === user.id) ? "outline" : "default"}
                onClick={async () => {
                  const exists = adminProfiles.some((p) => p.user_id === user.id);
                  if (exists) {
                    await removeAdminProfile(user.id);
                    toast({ title: "Anda dikeluarkan dari daftar janji temu." });
                    return;
                  }

                  const existingProfile = adminProfiles.find((p) => p.user_id === user.id);
                  const added = await ensureDirectoryProfile({
                    id: user.id,
                    name: user.name,
                    jabatan: user.jabatan,
                    wa_number: existingProfile?.wa_number ?? user.whatsapp,
                    avatar_url: user.avatar_url,
                  });

                  if (added) {
                    toast({ title: "Anda berhasil dicantumkan ke daftar janji temu." });
                  }
                }}
              >
                {adminProfiles.some((p) => p.user_id === user.id)
                  ? "Keluarkan Saya dari Daftar"
                  : "Cantumkan Saya di Daftar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* add admin form (single searchable bar) */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="w-full">
            <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Input
                placeholder="Cari atau pilih anggota..."
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
                        u.role !== newElevatedRole &&
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
                  {allUsers.filter((u) => u.role !== newElevatedRole).length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Tidak ada kandidat
                    </div>
                  )}
                </div>
              )}
            </div>
            <Select value={newElevatedRole} onValueChange={(v) => setNewElevatedRole(v as "HR" | "PH") }>
              <SelectTrigger className="w-full lg:w-[160px] shrink-0">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HR">HR</SelectItem>
                <SelectItem value="PH">PH</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="w-full lg:w-auto shrink-0 whitespace-nowrap"
              disabled={!newAdminId}
              onClick={async () => {
                const user = allUsers.find((u) => u.id === newAdminId);
                if (user) {
                  await changeUserRole(user.id, newElevatedRole);
                  await ensureDirectoryProfile({
                    id: user.id,
                    name: user.name,
                    jabatan: user.jabatan,
                    wa_number: user.whatsapp,
                    avatar_url: user.avatar_url,
                  });
                  setNewAdminId("");
                  setAddSearch("");
                }
              }}
            >
              Angkat Jadi {newElevatedRole}
            </Button>
          </div>
        </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div>
            <label className="sr-only" htmlFor="admin-search">
              Cari HR/PH
            </label>
            <Input
              id="admin-search"
              placeholder="Cari HR/PH..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-sm"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>HR/PH</TableHead>
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

                return (
                  <TableRow key={profile.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatarWithPreview
                          name={profile.display_name}
                          avatarUrl={adminUser?.avatar_url ?? profile.avatar_url}
                          sizeClassName="h-9 w-9"
                          fallbackClassName="bg-primary text-primary-foreground text-xs font-semibold"
                          modalTitle="Foto Profil HR/PH"
                        />
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
                            if (newRole === "MEMBER") {
                              await removeAdminProfile(adminUser.id);
                            } else {
                              await ensureDirectoryProfile({
                                id: adminUser.id,
                                name: adminUser.name,
                                jabatan: adminUser.jabatan,
                                wa_number: undefined,
                                avatar_url: adminUser.avatar_url,
                              });
                            }
                          }}
                        >
                          <SelectTrigger className="w-[120px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MEMBER">Sender</SelectItem>
                            <SelectItem value="HR">HR</SelectItem>
                            <SelectItem value="PH">
                              PH
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {normalizePhoneTo62(profile.wa_number)}
                    </TableCell>
                    <TableCell className="text-sm flex items-center gap-1">
                      {(() => {
                        const effectiveStatus = getEffectiveStatus(profile);
                        const availabilityColor = effectiveStatus === "ONLINE" ? "🟢" : effectiveStatus === "AWAY" ? "🟡" : "⚫";
                        return (
                          <>
                            {availabilityColor}
                            {AVAILABILITY_LABELS[effectiveStatus]}
                          </>
                        );
                      })()}
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
