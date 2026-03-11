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
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { CATEGORY_LABELS, type ReportCategory, type Urgency } from "@/data/mockData";

const categories = Object.entries(CATEGORY_LABELS) as [ReportCategory, string][];

export default function ReportForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { addReport } = useData();

  const [category, setCategory] = useState<ReportCategory | "">("");
  const [urgency, setUrgency] = useState<Urgency>("RENDAH");
  const [chronology, setChronology] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  if (!user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || chronology.length < 50) {
      toast({
        title: "Peringatan",
        description: "Mohon lengkapi semua kolom. Kronologi minimal 50 karakter.",
        variant: "destructive",
      });
      return;
    }

    const report = addReport({
      user_id: user.id,
      category: category as ReportCategory,
      urgency,
      kronologi: chronology,
      is_anonymous: anonymous,
    });

    toast({
      title: "Berhasil! ✅",
      description: `Laporan berhasil dikirim dengan ID: ${report.case_id}`,
    });

    setTimeout(() => navigate(`/laporan/${report.id}`), 800);
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
                <Input value={user.name} readOnly className="mt-1 bg-card" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Biro/Bidang</Label>
                <Input value={user.biro} readOnly className="mt-1 bg-card" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Jabatan</Label>
                <Input value={user.jabatan} readOnly className="mt-1 bg-card" />
              </div>
            </div>

            {/* Category */}
            <div>
              <Label>Kategori Masalah</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ReportCategory)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih kategori..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Urgency */}
            <div>
              <Label>Tingkat Urgensi</Label>
              <RadioGroup value={urgency} onValueChange={(v) => setUrgency(v as Urgency)} className="flex gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="RENDAH" id="low" />
                  <Label htmlFor="low" className="text-green-600 font-medium cursor-pointer">Rendah</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="SEDANG" id="med" />
                  <Label htmlFor="med" className="text-yellow-600 font-medium cursor-pointer">Sedang</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="TINGGI" id="high" />
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
                placeholder="Ceritakan detail permasalahan yang Anda alami (min. 50 karakter)..."
                className="mt-1 min-h-[120px]"
              />
              <p className={`text-xs mt-1 ${chronology.length >= 50 ? "text-green-600" : "text-muted-foreground"}`}>
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
