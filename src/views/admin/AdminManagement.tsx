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
  BIRO_LABELS,
  type UserRole,
} from "@/data/domain";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { isValidPhone62, normalizePhoneTo62 } from "@/lib/phone";
import { UserAvatarWithPreview } from "@/components/shared/UserAvatarWithPreview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function AdminManagement() {
  const { adminProfiles, addAdminProfile, removeAdminProfile, getEffectiveStatus } = useData();
  const { user, allUsers, changeUserRole, refreshUsers } = useAuth();
  const { toast } = useToast();

  const [newAdminId, setNewAdminId] = useState<string>("");
  const [newElevatedRole, setNewElevatedRole] = useState<"HR" | "PH">("HR");
  const [search, setSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [userSearch, setUserSearch] = useState("");
  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null);

  const handleVerifyUser = async (targetUserId: string) => {
    setVerifyingUserId(targetUserId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
      }

      const response = await fetch("/api/secure/auth/verify-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ targetUserId }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Gagal memverifikasi pengguna.");
      }

      toast({
        title: "Aktivasi Akun Berhasil",
        description: "Pengguna telah berhasil diaktifkan dan dikonfirmasi.",
      });

      await refreshUsers();
    } catch (error) {
      toast({
        title: "Gagal mengaktifkan akun",
        description: error instanceof Error ? error.message : "Terjadi kesalahan.",
        variant: "destructive",
      });
    } finally {
      setVerifyingUserId(null);
    }
  };

  const ensureDirectoryProfile = async (target: {
    id: string;
    name: string;
    jabatan: keyof typeof JABATAN_LABELS;
    wa_number?: string | null;
    avatar_url?: string | null;
  }) => {
    const existingProfile = adminProfiles.find((p) => p.user_id === target.id);
    
    // Logic fix: Prefer existing profile phone if the one passed is empty/null.
    // This ensures that switching roles doesn't overwrite a valid directory phone with an empty profile phone.
    const rawPhone = target.wa_number || existingProfile?.wa_number || "";
    const normalizedPhone = normalizePhoneTo62(rawPhone);

    if (!isValidPhone62(normalizedPhone)) {
      toast({
        title: "Nomor HP belum valid",
        description: "Anggota tim HR/PH ini perlu mengatur nomor HP yang valid di profil agar fitur janji temu berfungsi.",
        variant: "destructive",
      });
    }

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
    <div className="space-y-6 page-enter">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-8 text-primary-foreground shadow-lg shadow-primary/10">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold">Kelola HR dan PH</h1>
          <p className="mt-1 text-primary-foreground/80 text-sm font-medium">
            Atur role, ketersediaan, dan verifikasi akun tim PSDM.
          </p>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8 animate-float" />
      </div>

      <Tabs defaultValue="hr-ph" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-4">
          <TabsTrigger value="hr-ph">Kelola HR & PH</TabsTrigger>
          <TabsTrigger value="all-users">Daftar Pengguna / Aktivasi</TabsTrigger>
        </TabsList>

        <TabsContent value="hr-ph" className="space-y-6">
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
                      const result = await changeUserRole(user.id, newElevatedRole);
                      if (!result.success) {
                        toast({
                          title: "Gagal mengubah role",
                          description: result.error,
                          variant: "destructive",
                        });
                        return;
                      }

                      await ensureDirectoryProfile({
                        id: user.id,
                        name: user.name,
                        jabatan: user.jabatan,
                        wa_number: user.whatsapp,
                        avatar_url: user.avatar_url,
                      });
                      setNewAdminId("");
                      setAddSearch("");
                      toast({
                        title: "Berhasil mengubah role",
                        description: `${user.name} sekarang adalah ${newElevatedRole}.`,
                      });
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
                                const result = await changeUserRole(adminUser.id, newRole);
                                if (!result.success) {
                                  toast({
                                    title: "Gagal mengubah role",
                                    description: result.error,
                                    variant: "destructive",
                                  });
                                  return;
                                }

                                if (newRole === "MEMBER") {
                                  await removeAdminProfile(adminUser.id);
                                } else {
                                  await ensureDirectoryProfile({
                                    id: adminUser.id,
                                    name: adminUser.name,
                                    jabatan: adminUser.jabatan,
                                    wa_number: adminUser.whatsapp,
                                    avatar_url: adminUser.avatar_url,
                                  });
                                }
                                toast({
                                  title: "Role diperbarui",
                                  description: `${adminUser.name} sekarang adalah ${newRole}.`,
                                });
                              }}
                            >
                              <SelectTrigger className="w-[120px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="MEMBER">Member</SelectItem>
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
        </TabsContent>

        <TabsContent value="all-users" className="space-y-6">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Input
                  placeholder="Cari semua pengguna berdasarkan nama/email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full max-w-sm"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama / Email</TableHead>
                    <TableHead>Biro / Bidang</TableHead>
                    <TableHead>Jabatan</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allUsers
                    .filter((u) => {
                      const term = userSearch.toLowerCase();
                      return (
                        u.name.toLowerCase().includes(term) ||
                        u.email.toLowerCase().includes(term)
                      );
                    })
                    .map((u) => {
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <UserAvatarWithPreview
                                name={u.name}
                                avatarUrl={u.avatar_url}
                                sizeClassName="h-9 w-9"
                                fallbackClassName="bg-primary text-primary-foreground text-xs font-semibold"
                                modalTitle="Foto Profil Pengguna"
                              />
                              <div>
                                <p className="text-sm font-medium">{u.name}</p>
                                <p className="text-[10px] text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {BIRO_LABELS[u.biro] || u.biro}
                          </TableCell>
                          <TableCell className="text-sm">
                            {JABATAN_LABELS[u.jabatan] || u.jabatan}
                          </TableCell>
                          <TableCell className="text-sm font-semibold">
                            {u.role}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                u.is_active
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? "bg-green-500" : "bg-amber-500"}`} />
                              {u.is_active ? "Aktif" : "Menunggu Aktivasi"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {!u.is_active && (
                              <Button
                                size="sm"
                                disabled={verifyingUserId !== null || user?.role !== "PH"}
                                onClick={() => handleVerifyUser(u.id)}
                                className="h-8 font-semibold"
                              >
                                {verifyingUserId === u.id ? (
                                  <>
                                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                    Mengaktifkan...
                                  </>
                                ) : (
                                  "Aktifkan Akun"
                                )}
                              </Button>
                            )}
                            {u.is_active && (
                              <span className="text-xs text-muted-foreground italic">Sudah Aktif</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {allUsers.filter((u) => {
                    const term = userSearch.toLowerCase();
                    return (
                      u.name.toLowerCase().includes(term) ||
                      u.email.toLowerCase().includes(term)
                    );
                  }).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-sm text-muted-foreground">
                        Tidak ada pengguna yang cocok.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
