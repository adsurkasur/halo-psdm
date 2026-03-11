import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  BIRO_LABELS,
  JABATAN_LABELS,
  type BiroBidang,
  type Jabatan,
} from "@/data/mockData";

type AuthMode = "login" | "register";

const biroEntries = Object.entries(BIRO_LABELS) as [BiroBidang, string][];
const jabatanEntries = Object.entries(JABATAN_LABELS) as [Jabatan, string][];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register, isSender, isAdmin, isSuperAdmin } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [biro, setBiro] = useState<BiroBidang | "">("");
  const [jabatan, setJabatan] = useState<Jabatan | "">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);

  const redirectAfterAuth = () => {
    setTimeout(() => {
      if (isSender) navigate("/dashboard");
      else if (isSuperAdmin) navigate("/admin");
      else if (isAdmin) navigate("/admin");
      else navigate("/dashboard");
    }, 100);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = login(email, password);
      setLoading(false);
      if (!result.success) {
        setError(result.error ?? "Login gagal.");
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
        return;
      }
      redirectAfterAuth();
    }, 400);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !password.trim() || !biro || !jabatan) {
      setError("Semua kolom wajib diisi.");
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const result = register({ name: name.trim(), email: email.trim(), password, biro, jabatan });
      setLoading(false);
      if (!result.success) {
        setError(result.error ?? "Registrasi gagal.");
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
        return;
      }
      redirectAfterAuth();
    }, 600);
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError("");
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError("");
    setEmail("");
    setPassword("");
    setName("");
    setBiro("");
    setJabatan("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4">
      <div className="w-full max-w-md animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-8 animate-float">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary text-primary-foreground text-2xl font-bold shadow-lg shadow-primary/30">
            HP
          </div>
          <h1 className="text-2xl font-bold mt-4">Halo PSDM</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sistem Komunikasi Dua Arah — ARSC 2025/2026
          </p>
        </div>

        {/* Auth Card */}
        <Card className={`shadow-xl border-0 ${shaking ? "animate-shake" : ""}`}>
          <CardContent className="pt-6 pb-6">
            {/* Tab Switcher */}
            <div className="flex bg-muted rounded-lg p-1 mb-6">
              <button
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  mode === "login"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => switchMode("login")}
              >
                Masuk
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  mode === "register"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => switchMode("register")}
              >
                Daftar
              </button>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4 animate-scale-in">
                {error}
              </div>
            )}

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@arsc.org"
                    className="mt-1 transition-all duration-200 focus:shadow-md"
                    required
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password..."
                    className="mt-1 transition-all duration-200 focus:shadow-md"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-base font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-primary/30" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Memproses...
                    </span>
                  ) : (
                    "Masuk"
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4 animate-fade-in">
                <div>
                  <Label>Nama Lengkap</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama lengkap Anda"
                    className="mt-1 transition-all duration-200 focus:shadow-md"
                    required
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@arsc.org"
                    className="mt-1 transition-all duration-200 focus:shadow-md"
                    required
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="mt-1 transition-all duration-200 focus:shadow-md"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <Label>Biro / Bidang</Label>
                  <Select value={biro} onValueChange={(v) => setBiro(v as BiroBidang)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Pilih biro/bidang..." />
                    </SelectTrigger>
                    <SelectContent>
                      {biroEntries.map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Jabatan</Label>
                  <Select value={jabatan} onValueChange={(v) => setJabatan(v as Jabatan)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Pilih jabatan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {jabatanEntries.map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full h-11 text-base font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-primary/30" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Mendaftarkan...
                    </span>
                  ) : (
                    "Daftar & Masuk"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Demo accounts — only show in login mode */}
        {mode === "login" && (
          <Card className="mt-4 border-0 shadow-md animate-slide-up" style={{ animationDelay: "200ms" }}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground text-center mb-3 font-medium">Akun Demo</p>
              <div className="space-y-1.5 stagger-children">
                {[
                  { name: "Ade Surya Ananda", email: "ade@arsc.org", pass: "ade123", role: "Sender" },
                  { name: "Rizky Pratama", email: "rizky@arsc.org", pass: "rizky123", role: "Sender" },
                  { name: "Fatimah Zahra", email: "fatimah@arsc.org", pass: "fatimah123", role: "Sender" },
                  { name: "Sarah Amelia", email: "sarah@arsc.org", pass: "sarah123", role: "Admin" },
                ].map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-accent/50 text-left transition-all duration-200 hover-lift"
                    onClick={() => fillDemo(a.email, a.pass)}
                  >
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-[10px] text-muted-foreground">{a.email}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      a.role === "Admin"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary"
                    }`}>
                      {a.role}
                    </span>
                  </button>
                ))}
                <details className="text-center">
                  <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-primary transition-colors inline-flex items-center gap-1">
                    ▸ +2 akun lainnya
                  </summary>
                  <div className="mt-1.5 space-y-1.5">
                    {[
                      { name: "Dimas Prayoga", email: "dimas@arsc.org", pass: "dimas123", role: "Admin" },
                      { name: "Nadia Putri", email: "nadia@arsc.org", pass: "nadia123", role: "Super Admin" },
                    ].map((a) => (
                      <button
                        key={a.email}
                        type="button"
                        className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-accent/50 text-left transition-all duration-200 hover-lift"
                        onClick={() => fillDemo(a.email, a.pass)}
                      >
                        <div>
                          <p className="text-sm font-medium">{a.name}</p>
                          <p className="text-[10px] text-muted-foreground">{a.email}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          a.role === "Super Admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-destructive/10 text-destructive"
                        }`}>
                          {a.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          ARSC · Divisi Pengembangan Sumber Daya Manusia · 2025/2026
        </p>
      </div>
    </div>
  );
}
