import { useState, useEffect, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useNavigate } from "react-router-dom";
import { Camera, Upload, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase/client";
import { UserAvatarWithPreview } from "@/components/shared/UserAvatarWithPreview";
import {
  BIRO_LABELS,
  JABATAN_LABELS,
  type BiroBidang,
  type Jabatan,
} from "@/data/domain";
import { Separator } from "@/components/ui/separator";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, updateProfile, logout } = useAuth();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [biro, setBiro] = useState<BiroBidang | "">("");
  const [jabatan, setJabatan] = useState<Jabatan | "">("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
  const DELETE_CONFIRMATION_PHRASE = "delete account";

  // sync when user becomes available
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setBiro(user.biro);
      setJabatan(user.jabatan);
      setWhatsapp(user.whatsapp ?? "");
      setAvatarPreviewUrl(null);
    }
  }, [user]);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixelsValue: Area) => {
    setCroppedAreaPixels(croppedAreaPixelsValue);
  }, []);

  const createImage = useCallback((source: string) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });
  }, []);

  const getCroppedBlob = useCallback(
    async (imageSrc: string, pixelCrop: Area) => {
      const image = await createImage(imageSrc);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas tidak tersedia.");
      }

      const outputSize = 512;
      canvas.width = outputSize;
      canvas.height = outputSize;

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        outputSize,
        outputSize
      );

      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Gagal memproses gambar."));
            return;
          }
          resolve(blob);
        }, "image/jpeg", 0.9);
      });
    },
    [createImage]
  );

  if (!user) return null;

  const handleAvatarFileSelect = async (selected: File | null) => {
    if (!selected) {
      return;
    }

    if (!selected.type.startsWith("image/")) {
      toast({ title: "File harus berupa gambar.", variant: "destructive" });
      return;
    }

    if (selected.size > MAX_AVATAR_SIZE) {
      toast({ title: "Ukuran foto maksimal 5MB.", variant: "destructive" });
      return;
    }

    const localUrl = URL.createObjectURL(selected);
    setCropImageUrl(localUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setIsCropOpen(true);
  };

  const handleCropApply = async () => {
    if (!cropImageUrl || !croppedAreaPixels) {
      toast({ title: "Area crop belum siap.", variant: "destructive" });
      return;
    }

    try {
      const croppedBlob = await getCroppedBlob(cropImageUrl, croppedAreaPixels);
      const fileName = `avatar-${Date.now()}.jpg`;
      const croppedFile = new File([croppedBlob], fileName, { type: "image/jpeg" });
      const newPreviewUrl = URL.createObjectURL(croppedBlob);

      setAvatarFile(croppedFile);
      setAvatarPreviewUrl(newPreviewUrl);
      setIsCropOpen(false);
      toast({ title: "Foto siap diunggah." });
    } catch {
      toast({ title: "Gagal memproses crop gambar.", variant: "destructive" });
    }
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) {
      toast({ title: "Pilih dan crop foto terlebih dahulu.", variant: "destructive" });
      return;
    }

    setUploadingAvatar(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
      }

      const formData = new FormData();
      formData.append("avatar", avatarFile);

      const response = await fetch("/api/secure/profile/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; avatar_url?: string };

      if (!response.ok || !payload.avatar_url) {
        throw new Error(payload.error ?? "Gagal upload foto profil.");
      }

      const updated = await updateProfile({ avatar_url: payload.avatar_url });
      if (!updated.success) {
        throw new Error(updated.error ?? "Gagal menyinkronkan foto profil.");
      }

      setAvatarFile(null);
      setAvatarPreviewUrl(null);
      toast({ title: "Foto profil berhasil diperbarui." });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Gagal upload foto profil.",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const closeCropDialog = () => {
    setIsCropOpen(false);
    if (cropImageUrl) {
      URL.revokeObjectURL(cropImageUrl);
    }
    setCropImageUrl(null);
  };

  const handleDeleteAccount = async () => {
    if (deletePhrase.trim().toLowerCase() !== DELETE_CONFIRMATION_PHRASE) {
      toast({ title: "Ketik tepat: delete account", variant: "destructive" });
      return;
    }

    if (deleteEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      toast({ title: "Email konfirmasi tidak cocok.", variant: "destructive" });
      return;
    }

    setDeletingAccount(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
      }

      const response = await fetch("/api/secure/profile/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          confirmationPhrase: deletePhrase,
          email: deleteEmail,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Gagal menghapus akun.");
      }

      toast({ title: "Akun berhasil dihapus." });
      logout();
      navigate("/login", { replace: true });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Gagal menghapus akun.",
        variant: "destructive",
      });
    } finally {
      setDeletingAccount(false);
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

    let formattedWhatsapp = whatsapp.trim();
    if (formattedWhatsapp.startsWith("0")) {
      formattedWhatsapp = "62" + formattedWhatsapp.slice(1);
    } else if (formattedWhatsapp.startsWith("+")) {
      formattedWhatsapp = formattedWhatsapp.slice(1);
    }

    setSaving(true);
    try {
      const result = await updateProfile({
        name,
        email,
        biro: biro as BiroBidang,
        jabatan: jabatan as Jabatan,
        whatsapp: formattedWhatsapp,
        ...(password ? { password } : {}),
      });

      if (!result.success) {
        toast({
          title: result.error ?? "Gagal memperbarui profil",
          variant: "destructive",
        });
      } else {
        toast({ title: result.message ?? "Profil diperbarui" });
        if (password) {
          setPassword("");
          setConfirm("");
        }
      }
    } catch (err) {
      toast({
        title: "Terjadi kesalahan saat menyimpan profil.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col space-y-6 page-enter pb-10">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-8 text-primary-foreground shadow-lg shadow-primary/10">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold">Pengaturan Akun</h1>
          <p className="mt-1 text-primary-foreground/80 text-sm font-medium">
            Kelola informasi profil dan kredensial akses Anda.
          </p>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8 animate-float" />
      </div>
      <Card className="shadow-xl shadow-primary/5 border-primary/10">
        <CardContent className="p-6 md:p-8 space-y-10">
          {/* Section: Avatar */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-primary rounded-full" />
              <h2 className="text-lg font-bold">Foto Profil</h2>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-8 p-6 rounded-2xl border bg-muted/20 border-primary/5 relative group transition-all duration-300 hover:bg-muted/30">
              <div className="relative">
                <UserAvatarWithPreview
                  name={user.name}
                  avatarUrl={avatarPreviewUrl ?? user.avatar_url}
                  sizeClassName="h-32 w-32 md:h-40 md:w-40 ring-4 ring-background shadow-2xl"
                  fallbackClassName="bg-primary text-primary-foreground text-4xl font-bold"
                  modalTitle="Pratinjau Foto Profil"
                />
                <label 
                  htmlFor="profile-avatar-input"
                  className="absolute bottom-2 right-2 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer shadow-lg transition-transform hover:scale-110 active:scale-95"
                >
                  <Camera className="h-5 w-5" />
                </label>
              </div>

              <div className="flex-1 space-y-4 w-full">
                <div className="space-y-1">
                  <p className="font-semibold text-base">Perbarui Foto</p>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                    Gunakan foto terbaik Anda. Format PNG, JPG atau WEBP (Maks. 5MB). 
                    Sistem akan melakukan crop dan resize otomatis untuk avatar.
                  </p>
                </div>
                
                <Input
                  id="profile-avatar-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => void handleAvatarFileSelect(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 flex items-center px-4 py-2 bg-background rounded-xl border text-sm text-muted-foreground truncate italic">
                    {avatarFile?.name ?? "Belum ada file dipilih"}
                  </div>
                  <Button
                    type="button"
                    className="gap-2 px-6 rounded-xl shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
                    onClick={handleUploadAvatar}
                    disabled={uploadingAvatar || !avatarFile}
                  >
                    {uploadingAvatar ? <Upload className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploadingAvatar ? "Mengunggah..." : "Unggah & Simpan"}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <Separator className="opacity-50" />

          {/* Section: Basic Identity */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-primary rounded-full" />
              <h2 className="text-lg font-bold">Identitas Dasar</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="profile-name" className="text-sm font-semibold ml-1">Nama Lengkap</Label>
                <Input 
                  id="profile-name"
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="rounded-xl border-primary/10 focus:border-primary focus:ring-primary/20"
                  placeholder="Masukkan nama lengkap"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email" className="text-sm font-semibold ml-1">Alamat Email</Label>
                <Input 
                  id="profile-email"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="rounded-xl border-primary/10 focus:border-primary focus:ring-primary/20"
                  placeholder="email@contoh.com"
                />
                <p className="text-[10px] text-muted-foreground px-1">
                  💡 Memerlukan konfirmasi ulang pada email baru dan lama.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-whatsapp" className="text-sm font-semibold ml-1">Nomor WhatsApp</Label>
                <Input
                  id="profile-whatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="6281234567890"
                  className="rounded-xl border-primary/10 focus:border-primary focus:ring-primary/20"
                />
                <p className="text-[10px] text-muted-foreground px-1">
                  Format: kode negara (misal 62) + nomor tanpa 0 depan.
                </p>
              </div>
            </div>
          </section>

          <Separator className="opacity-50" />

          {/* Section: Organization */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-primary rounded-full" />
              <h2 className="text-lg font-bold">Organisasi</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold ml-1">Biro / Bidang</Label>
                <Select value={biro} onValueChange={(v) => setBiro(v as BiroBidang)}>
                  <SelectTrigger className="rounded-xl border-primary/10">
                    <SelectValue placeholder="Pilih biro" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(BIRO_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key} className="rounded-lg">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold ml-1">Jabatan</Label>
                <Select value={jabatan} onValueChange={(v) => setJabatan(v as Jabatan)}>
                  <SelectTrigger className="rounded-xl border-primary/10">
                    <SelectValue placeholder="Pilih jabatan" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(JABATAN_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key} className="rounded-lg">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <Separator className="opacity-50" />

          {/* Section: Security */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-primary rounded-full" />
              <h2 className="text-lg font-bold">Keamanan Akun</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="profile-pass" className="text-sm font-semibold ml-1">Password Baru</Label>
                <Input
                  id="profile-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl border-primary/10"
                  placeholder="Kosongkan jika tidak ingin diubah"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-confirm" className="text-sm font-semibold ml-1">Konfirmasi Password</Label>
                <Input
                  id="profile-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="rounded-xl border-primary/10"
                  placeholder="Ulangi password baru"
                />
              </div>
            </div>
          </section>

          <div className="pt-4">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="w-full md:w-auto px-12 h-12 text-base font-bold rounded-2xl shadow-xl shadow-primary/20 transition-all hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving ? "Menyimpan..." : "Simpan Semua Perubahan"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2 className="font-semibold text-destructive">Zona Berbahaya</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Menghapus akun akan menghapus data profil, login, dan file milik akun ini secara permanen.
            </p>
          </div>
          <Button type="button" variant="destructive" className="gap-2" onClick={() => setIsDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isCropOpen} onOpenChange={(open) => {
        if (!open) {
          closeCropDialog();
          return;
        }
        setIsCropOpen(true);
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Crop Foto Profil</DialogTitle>
            <DialogDescription>Atur posisi dan zoom agar foto terlihat proporsional pada avatar.</DialogDescription>
          </DialogHeader>

          <div className="relative h-72 w-full overflow-hidden rounded-md bg-black/80">
            {cropImageUrl ? (
              <Cropper
                image={cropImageUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Zoom</Label>
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(value) => setZoom(value[0] ?? 1)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeCropDialog}>
              Batal
            </Button>
            <Button type="button" onClick={() => void handleCropApply()}>
              Gunakan Foto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus Akun</DialogTitle>
            <DialogDescription>
              Ketik <strong>delete account</strong> dan masukkan email akun untuk melanjutkan penghapusan permanen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Ketik konfirmasi</Label>
              <Input
                value={deletePhrase}
                onChange={(e) => setDeletePhrase(e.target.value)}
                placeholder="delete account"
              />
            </div>
            <div>
              <Label>Email akun</Label>
              <Input
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
                placeholder={user.email}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteAccount()}
              disabled={deletingAccount}
            >
              {deletingAccount ? "Menghapus..." : "Hapus Akun Permanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
