import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { mockUsers } from "@/data/mockData";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      const result = login(email, password);
      if (!result.success) {
        setError(result.error || "Login gagal");
      }
      setLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Logo / Branding */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <span className="text-2xl font-extrabold text-primary-foreground tracking-tight">HP</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Halo PSDM</h1>
          <p className="text-sm text-muted-foreground">
            Sistem Komunikasi Dua Arah — ARSC 2025/2026
          </p>
        </div>

        {/* Login Form */}
        <Card className="shadow-lg border-0">
          <CardContent className="pt-6 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@arsc.org"
                  className="mt-1"
                  autoFocus
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password..."
                  className="mt-1"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-destructive font-medium bg-destructive/10 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Masuk..." : "Masuk"}
              </Button>
            </form>

            {/* Demo accounts */}
            <div className="border-t pt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground text-center">
                Akun Demo
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {mockUsers.slice(0, 4).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted hover:bg-accent transition-colors text-left"
                    onClick={() => {
                      setEmail(u.email);
                      setPassword(u.password);
                      setError("");
                    }}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {u.email}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                      u.role === "SENDER"
                        ? "bg-blue-100 text-blue-700"
                        : u.role === "ADMIN"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-purple-100 text-purple-700"
                    }`}>
                      {u.role === "SENDER" ? "Sender" : u.role === "ADMIN" ? "Admin" : "Super Admin"}
                    </span>
                  </button>
                ))}
                {/* Show remaining accounts collapsed */}
                <details className="group">
                  <summary className="text-[10px] text-muted-foreground text-center cursor-pointer hover:text-foreground transition-colors py-1">
                    +{mockUsers.length - 4} akun lainnya
                  </summary>
                  <div className="space-y-1.5 mt-1.5">
                    {mockUsers.slice(4).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted hover:bg-accent transition-colors text-left"
                        onClick={() => {
                          setEmail(u.email);
                          setPassword(u.password);
                          setError("");
                        }}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{u.name}</p>
                          <p className="text-[10px] text-muted-foreground">{u.email}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                          u.role === "SENDER"
                            ? "bg-blue-100 text-blue-700"
                            : u.role === "ADMIN"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-purple-100 text-purple-700"
                        }`}>
                          {u.role === "SENDER" ? "Sender" : u.role === "ADMIN" ? "Admin" : "Super Admin"}
                        </span>
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground">
          ARSC · Divisi Pengembangan Sumber Daya Manusia · 2025/2026
        </p>
      </div>
    </div>
  );
}
