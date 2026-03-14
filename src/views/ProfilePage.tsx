import { useState, useEffect } from "react";
import { Camera, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase/client";
import { UserAvatarWithPreview } from "@/components/shared/UserAvatarWithPreview";
import {
  BIRO_LABELS,
  JABATAN_LABELS,
  type BiroBidang,
  type Jabatan,
} from "@/data/domain";

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [biro, setBiro] = useState<BiroBidang | "">("");
  const [jabatan, setJabatan] = useState<Jabatan | "">("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const PROFILE_BUCKET = "profile-pictures";
  const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

  // sync when user becomes available
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setBiro(user.biro);
      setJabatan(user.jabatan);
    }
  }, [user]);

  if (!user) return null;

  const handleUploadAvatar = async () => {
    if (!avatarFile) {
      toast({ title: "Pilih foto terlebih dahulu.", variant: "destructive" });
      return;
    }

    if (!avatarFile.type.startsWith("image/")) {
      toast({ title: "File harus berupa gambar.", variant: "destructive" });
      return;
    }

    if (avatarFile.size > MAX_AVATAR_SIZE) {
      toast({ title: "Ukuran foto maksimal 5MB.", variant: "destructive" });
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = avatarFile.name.includes(".") ? avatarFile.name.split(".").pop() : "jpg";
      const path = `${user.id}/avatar-${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const upload = await supabase.storage
        .from(PROFILE_BUCKET)
        .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type || undefined });

      if (upload.error) throw upload.error;

      const { data: publicUrlData } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path);
      const updated = await updateProfile({ avatar_url: publicUrlData.publicUrl });

      if (!updated.success) {
        throw new Error(updated.error ?? "Gagal menyimpan foto profil.");
      }

      setAvatarFile(null);
      toast({ title: "Foto profil berhasil diperbarui." });
    } catch {
      toast({ title: "Gagal upload foto profil.", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (password && password !== confirm) {
      toast({
        title: "Password dan konfirmasi tidak cocok",
        variant: "destructive",
      });
      return;
    }
    if (!biro || !jabatan) {
      toast({
        title: "Biro dan jabatan harus dipilih.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    setTimeout(() => {
      void (async () => {
        const result = await updateProfile({
        name,
        email,
        biro: biro as BiroBidang,
        jabatan: jabatan as Jabatan,
        ...(password ? { password } : {}),
        });
        if (!result.success) {
          toast({
            title: result.error ?? "Gagal memperbarui profil",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }

        toast({ title: "Profil diperbarui" });
        setSaving(false);
      })();
    }, 400);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold">Pengaturan Profil</h1>
      <Card>
        <CardContent className="space-y-4">
          <div>
            <Label>Foto Profil</Label>
            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-4 rounded-lg border bg-muted/20 p-3">
              <UserAvatarWithPreview
                name={user.name}
                avatarUrl={user.avatar_url}
                sizeClassName="h-20 w-20"
                fallbackClassName="bg-primary text-primary-foreground text-lg"
                modalTitle="Foto Profil"
              />
              <div className="space-y-2 w-full">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto gap-2"
                  onClick={handleUploadAvatar}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? <Upload className="h-4 w-4 animate-pulse" /> : <Camera className="h-4 w-4" />}
                  {uploadingAvatar ? "Mengunggah..." : "Perbarui Foto Profil"}
                </Button>
                <p className="text-xs text-muted-foreground">Format PNG/JPG/WEBP, maksimal 5MB. Klik foto untuk melihat ukuran penuh.</p>
              </div>
            </div>
          </div>

          <div>
            <Label>Nama</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Biro/Bidang</Label>
            <Select value={biro} onValueChange={(v) => setBiro(v as BiroBidang)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih biro" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BIRO_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Jabatan</Label>
            <Select value={jabatan} onValueChange={(v) => setJabatan(v as Jabatan)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih jabatan" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(JABATAN_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Password Baru</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label>Konfirmasi Password</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            Simpan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
