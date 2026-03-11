import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const categories = ["Konflik Antar Anggota", "Beban Kerja", "Kesejahteraan", "Akademik", "Lainnya"];

export default function ReportForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [category, setCategory] = useState("");
  const [urgency, setUrgency] = useState("Rendah");
  const [chronology, setChronology] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || chronology.length < 50) {
      toast({ title: "Peringatan", description: "Mohon lengkapi semua kolom. Kronologi minimal 50 karakter.", variant: "destructive" });
      return;
    }
    const caseId = `HP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`;
    toast({ title: "Berhasil! ✅", description: `Laporan berhasil dikirim dengan ID: ${caseId}` });
    setTimeout(() => navigate("/"), 1500);
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Buat Laporan / Pengaduan</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Read-only identity */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Nama</Label>
                <Input value="Ade Surya Ananda" readOnly className="mt-1 bg-card" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Biro/Bidang</Label>
                <Input value="Media" readOnly className="mt-1 bg-card" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Jabatan</Label>
                <Input value="Anggota Muda" readOnly className="mt-1 bg-card" />
              </div>
            </div>

            {/* Category */}
            <div>
              <Label>Kategori Masalah</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih kategori..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Urgency */}
            <div>
              <Label>Tingkat Urgensi</Label>
              <RadioGroup value={urgency} onValueChange={setUrgency} className="flex gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Rendah" id="low" />
                  <Label htmlFor="low" className="text-status-done font-medium cursor-pointer">Rendah</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Sedang" id="med" />
                  <Label htmlFor="med" className="text-status-process font-medium cursor-pointer">Sedang</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Tinggi" id="high" />
                  <Label htmlFor="high" className="text-destructive font-medium cursor-pointer">Tinggi</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Chronology */}
            <div>
              <Label>Kronologi Permasalahan</Label>
              <Textarea
                value={chronology}
                onChange={(e) => setChronology(e.target.value)}
                placeholder="Ceritakan detail permasalahan yang Anda alami..."
                className="mt-1 min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {chronology.length}/50 karakter minimum
              </p>
            </div>

            {/* Anonymous */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <Label className="font-medium">Kirim Anonim</Label>
                <p className="text-xs text-muted-foreground">Sembunyikan identitas saya dari admin</p>
              </div>
              <Switch checked={anonymous} onCheckedChange={setAnonymous} />
            </div>

            <Button type="submit" className="w-full">Kirim Laporan</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
