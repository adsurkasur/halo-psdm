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
  const [phoneNumber, setPhoneNumber] = useState("");
  const [biro, setBiro] = useState<BiroBidang | "">("");
  const [jabatan, setJabatan] = useState<Jabatan | "">("");
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
      setPhoneNumber(user.phone_number ?? "");
      setBiro(user.biro);
      setJabatan(user.jabatan);
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
    if (!phoneNumber.trim()) {
      toast({
        title: "Nomor HP wajib diisi.",
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
        phone_number: phoneNumber,
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

        toast({ title: result.message ?? "Profil diperbarui" });
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
                avatarUrl={avatarPreviewUrl ?? user.avatar_url}
                sizeClassName="h-20 w-20"
                fallbackClassName="bg-primary text-primary-foreground text-lg"
                modalTitle="Foto Profil"
              />
              <div className="space-y-2 w-full">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => void handleAvatarFileSelect(e.target.files?.[0] ?? null)}
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
                <p className="text-xs text-muted-foreground">Format PNG/JPG/WEBP, maksimal 5MB. Crop dan resize otomatis ke ukuran avatar.</p>
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
            <p className="text-xs text-muted-foreground mt-1">Perubahan email akan meminta konfirmasi ulang di email lama dan email baru.</p>
          </div>
          <div>
            <Label>Nomor HP</Label>
            <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Contoh: 081234567890" />
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
