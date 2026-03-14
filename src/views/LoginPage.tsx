import { useEffect, useState } from "react";
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
} from "@/data/domain";
import { supabase } from "@/lib/supabase/client";
import { isValidPhone62, normalizePhoneTo62 } from "@/lib/phone";

type AuthMode = "login" | "register";

const biroEntries = Object.entries(BIRO_LABELS) as [BiroBidang, string][];
const jabatanEntries = Object.entries(JABATAN_LABELS) as [Jabatan, string][];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register, syncProfileNow, isSender, isPh } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [biro, setBiro] = useState<BiroBidang | "">("");
  const [jabatan, setJabatan] = useState<Jabatan | "">("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [syncFeedback, setSyncFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [newRecoveryPassword, setNewRecoveryPassword] = useState("");
  const [confirmRecoveryPassword, setConfirmRecoveryPassword] = useState("");
  const [syncingProfile, setSyncingProfile] = useState(false);
  const [shaking, setShaking] = useState(false);
  const showProfileSyncHelp =
    error.toLowerCase().includes("profil belum siap") ||
    error.toLowerCase().includes("profil belum bisa disinkronkan") ||
    error.toLowerCase().includes("sinkronisasi profil");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const recoveryFromQuery = searchParams.get("recovery") === "1";
    const recoveryFromHash = hashParams.get("type") === "recovery";
    setIsRecoveryMode(recoveryFromQuery || recoveryFromHash);
  }, []);

  const handleSyncProfileNow = async () => {
    setSyncingProfile(true);
    setInfo("");
    setSyncFeedback(null);

    const result = await syncProfileNow();
    setSyncingProfile(false);

    if (!result.success) {
      setError(result.error ?? "Profil belum bisa disinkronkan.");
      setSyncFeedback({
        type: "error",
        message: "Sinkronisasi gagal. Kamu bisa coba lagi, atau hubungi admin jika berulang.",
      });
      return;
    }

    setError("");
    setInfo("Profil berhasil disinkronkan. Mengarahkan...");
    setSyncFeedback({ type: "success", message: "Sinkronisasi berhasil. Profil akun sudah siap." });
    setTimeout(() => redirectAfterAuth(), 250);
  };

  const redirectAfterAuth = () => {
    setTimeout(() => {
      if (isSender) navigate("/dashboard");
      else if (isPh) navigate("/admin/dasbor");
      else navigate("/dashboard");
    }, 100);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    setTimeout(async () => {
      const result = await login(email, password);
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!name.trim() || !email.trim() || !phoneNumber.trim() || !password.trim() || !confirmPassword.trim() || !biro || !jabatan) {
      setError("Semua kolom wajib diisi.");
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak sama.");
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
      return;
    }

    const normalizedPhone = normalizePhoneTo62(phoneNumber);
    if (!isValidPhone62(normalizedPhone)) {
      setError("Nomor HP wajib menyertakan kode negara, contoh +628123... atau +1202555...");
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
      return;
    }

    setLoading(true);
    setTimeout(async () => {
      const result = await register({
        name: name.trim(),
        email: email.trim(),
        phone_number: normalizedPhone,
        password,
        biro,
        jabatan,
      });
      setLoading(false);
      if (!result.success) {
        setError(result.error ?? "Registrasi gagal.");
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
        return;
      }

      // In email-confirmation mode Supabase returns success without session.
      if (result.message) {
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setInfo(result.message);
        return;
      }

      redirectAfterAuth();
    }, 600);
  };

  const handleForgotPassword = async () => {
    setError("");
    setInfo("");

    if (!email.trim()) {
      setError("Masukkan email terlebih dahulu untuk reset password.");
      return;
    }

    setForgotPasswordLoading(true);
    const redirectTo = `${window.location.origin}/login?recovery=1`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setForgotPasswordLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setInfo("Link reset password sudah dikirim ke email kamu.");
  };

  const handleRecoveryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!newRecoveryPassword.trim() || !confirmRecoveryPassword.trim()) {
      setError("Password baru dan konfirmasi wajib diisi.");
      return;
    }

    if (newRecoveryPassword.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }

    if (newRecoveryPassword !== confirmRecoveryPassword) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setResettingPassword(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newRecoveryPassword });
    setResettingPassword(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setInfo("Password berhasil diperbarui. Silakan login dengan password baru.");
    setIsRecoveryMode(false);
    setNewRecoveryPassword("");
    setConfirmRecoveryPassword("");
    navigate("/login", { replace: true });
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError("");
    setInfo("");
    setSyncFeedback(null);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
    setPhoneNumber("");
    setBiro("");
    setJabatan("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-700 p-4">
      <div className="w-full max-w-md animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-8 animate-float">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary text-primary-foreground text-2xl font-bold shadow-lg shadow-primary/30">
            HP
          </div>
          <h1 className="text-2xl font-bold mt-4">Halo PSDM - ARSC FTP UB</h1>
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

            {showProfileSyncHelp && (
              <div className="bg-card text-foreground text-sm p-3 rounded-lg mb-4 border border-border animate-scale-in">
                <p className="font-medium mb-1">Yang bisa kamu lakukan sekarang:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Tunggu 1-2 menit lalu klik Masuk lagi.</li>
                  <li>Pastikan kamu login dengan email yang sama seperti saat verifikasi.</li>
                  <li>Kalau masih gagal, hubungi admin untuk sinkronisasi profil akun.</li>
                </ul>
                <Button
                  type="button"
                  className="mt-3 w-full"
                  onClick={handleSyncProfileNow}
                  disabled={syncingProfile || loading}
                >
                  {syncingProfile ? "Menyinkronkan..." : "Sinkronkan Profil Sekarang"}
                </Button>

                {syncFeedback && (
                  <div
                    className={`mt-2 rounded-md px-3 py-2 text-xs border ${
                      syncFeedback.type === "success"
                        ? "bg-emerald-100/70 text-emerald-800 border-emerald-200"
                        : "bg-destructive/10 text-destructive border-destructive/30"
                    }`}
                  >
                    {syncFeedback.message}
                  </div>
                )}
              </div>
            )}

            {info && (
              <div className="bg-emerald-100/70 text-emerald-800 text-sm p-3 rounded-lg mb-4 animate-scale-in border border-emerald-200">
                {info}
              </div>
            )}

            {mode === "login" && !isRecoveryMode ? (
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
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={handleForgotPassword}
                  disabled={forgotPasswordLoading || loading}
                >
                  {forgotPasswordLoading ? "Mengirim link reset..." : "Lupa password?"}
                </Button>
              </form>
            ) : mode === "login" && isRecoveryMode ? (
              <form onSubmit={handleRecoveryReset} className="space-y-4 animate-fade-in">
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                  Mode pemulihan password aktif. Masukkan password baru untuk akun kamu.
                </div>
                <div>
                  <Label>Password Baru</Label>
                  <Input
                    type="password"
                    value={newRecoveryPassword}
                    onChange={(e) => setNewRecoveryPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="mt-1 transition-all duration-200 focus:shadow-md"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <Label>Konfirmasi Password Baru</Label>
                  <Input
                    type="password"
                    value={confirmRecoveryPassword}
                    onChange={(e) => setConfirmRecoveryPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="mt-1 transition-all duration-200 focus:shadow-md"
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={resettingPassword}>
                  {resettingPassword ? "Menyimpan password..." : "Simpan Password Baru"}
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
                  <Label>Nomor HP</Label>
                  <Input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+628123456789 / +12025550123"
                    className="mt-1 transition-all duration-200 focus:shadow-md"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Gunakan format internasional dengan kode negara. Contoh: +628123456789 atau +12025550123.</p>
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
                  <Label>Konfirmasi Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password"
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
                    "Daftar"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          ARSC · Cakra Prakasa · 2025/2026
        </p>
      </div>
    </div>
  );
}
