import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import {
  BIRO_LABELS,
  JABATAN_LABELS,
  type BiroBidang,
  type Jabatan,
} from "@/data/mockData";

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [biro, setBiro] = useState<BiroBidang | "">("");
  const [jabatan, setJabatan] = useState<Jabatan | "">("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

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

  const handleSave = () => {
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
      updateProfile({
        name,
        email,
        biro: biro as BiroBidang,
        jabatan: jabatan as Jabatan,
        ...(password ? { password } : {}),
      });
      toast({ title: "Profil diperbarui" });
      setSaving(false);
    }, 400);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold">Pengaturan Profil</h1>
      <Card>
        <CardContent className="space-y-4">
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
