import { useState } from "react";
import { Phone, Calendar, Info, ShieldCheck, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { AVAILABILITY_LABELS, type AdminProfile } from "@/data/domain";
import { isValidPhone62, normalizePhoneTo62 } from "@/lib/phone";
import { Badge } from "@/components/ui/badge";

export default function AppointmentDirectory() {
  const { toast } = useToast();
  const { user, allUsers } = useAuth();
  const { adminProfiles, appointments, addAppointment, getEffectiveStatus } = useData();
  const [processingTargetId, setProcessingTargetId] = useState<string | null>(null);

  if (!user) return null;

  const handleContact = async (adminProfile: AdminProfile) => {
    if (processingTargetId) {
      toast({
        title: "Permintaan sedang diproses",
        description: "Mohon tunggu sebentar sebelum klik lagi.",
      });
      return;
    }

    setProcessingTargetId(adminProfile.user_id);

    try {
      const admin = allUsers.find((u) => u.id === adminProfile.user_id);
      const adminName = adminProfile.display_name || admin?.name || "HR";

      // Check 24h duplicate
      const recentApt = appointments.find(
        (a) =>
          a.user_id === user.id &&
          a.target_admin_id === adminProfile.user_id &&
          a.status === "OPEN" &&
          Date.now() - new Date(a.created_at).getTime() < 24 * 60 * 60 * 1000
      );

      if (recentApt) {
        toast({
          title: "Perhatian",
          description: `Anda baru saja menghubungi ${adminName}. Pastikan janji temu sebelumnya sudah selesai.`,
          variant: "destructive",
        });
        // We still allow it, but warn
      }

      const waNumber = normalizePhoneTo62(adminProfile.wa_number || admin?.whatsapp || "");
      if (!isValidPhone62(waNumber)) {
        toast({
          title: "Nomor WhatsApp belum valid",
          description: "Penerima belum mengatur nomor dengan kode negara (contoh: 628... atau 1...).",
          variant: "destructive",
        });
        return;
      }

      // Log appointment
      await addAppointment(user.id, adminProfile.user_id);

      // Build WA link
      const message = encodeURIComponent(
        `Halo Kak ${adminName}, saya ${user.name} dari ${user.biro} ingin mengajukan janji temu melalui Halo PSDM ARSC.`
      );
      const waUrl = `https://wa.me/${waNumber}?text=${message}`;

      toast({
        title: "Mengalihkan ke WhatsApp",
        description: `Membuka chat dengan ${adminName}...`,
      });

      window.open(waUrl, "_blank");
    } catch (error) {
      toast({
        title: "Gagal memproses janji temu",
        description: error instanceof Error ? error.message : "Coba lagi beberapa saat.",
        variant: "destructive",
      });
    } finally {
      setProcessingTargetId(null);
    }
  };

  const visibleProfiles = adminProfiles.filter((p) => p.user_id !== user?.id);

  return (
    <div className="container mx-auto p-4 lg:p-8 space-y-8 max-w-6xl page-enter">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-12 text-primary-foreground shadow-xl shadow-primary/20">
        <div className="relative z-10 max-w-2xl">
          <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30 backdrop-blur-sm">
            <Calendar className="mr-1 h-3 w-3" />
            Jadwalkan Konsultasi
          </Badge>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
            Janji Temu HR & PH
          </h1>
          <p className="text-primary-foreground/90 text-lg leading-relaxed mb-6">
            Pilih admin yang tersedia untuk berkonsultasi secara langsung melalui WhatsApp. 
            Kami siap membantu menjawab pertanyaan Anda dengan cepat.
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-sm bg-black/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <ShieldCheck className="h-4 w-4" />
              <span>Privasi Terjamin</span>
            </div>
            <div className="flex items-center gap-2 text-sm bg-black/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <Info className="h-4 w-4" />
              <span>Respon Cepat</span>
            </div>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-12 translate-x-12 animate-float" />
        <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-white/5 rounded-full translate-y-12 animate-float" style={{ animationDelay: "1s" }} />
      </div>

      {/* Directory Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Daftar Admin Tersedia
          </h2>
          <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
            {visibleProfiles.length} Admin Terdaftar
          </span>
        </div>

        {visibleProfiles.length === 0 ? (
          <Card className="border-dashed py-12">
            <CardContent className="flex flex-col items-center justify-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Belum Ada Admin</p>
                <p className="text-sm text-muted-foreground">Tidak ada admin lain yang terdaftar saat ini.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {visibleProfiles.map((profile) => {
              const initials = profile.display_name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              const effectiveStatus = getEffectiveStatus(profile);
              const isOnline = effectiveStatus === "ONLINE";
              const isAway = effectiveStatus === "AWAY";
              
              const availabilityColor = isOnline
                ? "bg-green-500"
                : isAway
                ? "bg-yellow-500"
                : "bg-gray-400";

              return (
                <Card 
                  key={profile.user_id} 
                  data-testid={`appointment-target-${profile.user_id}`} 
                  className="hover-lift border-0 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group"
                >
                  <div className="h-1.5 w-full bg-muted group-hover:bg-primary transition-colors" />
                  <CardContent className="p-6 space-y-6">
                    {/* Profile Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <Avatar className="h-16 w-16 border-2 border-background ring-2 ring-muted group-hover:ring-primary/20 transition-all">
                            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card ${availabilityColor} ${isOnline ? "animate-pulse-glow" : ""}`}
                          />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                            {profile.display_name}
                          </h3>
                          <Badge variant="outline" className="mt-1 font-medium bg-muted/30 border-muted-foreground/10">
                            {profile.jabatan_display}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Status Info */}
                    <div className="flex items-center gap-2 text-xs font-medium py-2 px-3 bg-muted/40 rounded-lg border border-muted-foreground/5">
                      <span className={`h-2 w-2 rounded-full ${availabilityColor}`} />
                      <span className="text-muted-foreground uppercase tracking-wider">
                        {AVAILABILITY_LABELS[effectiveStatus]}
                      </span>
                    </div>

                    {/* Contact button */}
                    <Button
                      data-testid={`appointment-contact-${profile.user_id}`}
                      className="w-full gap-2 h-11 text-sm font-semibold shadow-md shadow-primary/10 transition-all hover:shadow-lg hover:shadow-primary/20"
                      onClick={() => handleContact(profile)}
                      disabled={processingTargetId !== null}
                    >
                      {processingTargetId === profile.user_id ? (
                        <>
                          <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        <>
                          <Phone className="h-4 w-4" />
                          Hubungi via WhatsApp
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-muted/30 rounded-2xl p-6 border border-muted text-center space-y-2">
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto italic">
          "Komunikasi yang baik adalah awal dari solusi yang hebat. Jangan ragu untuk menghubungi kami."
        </p>
      </div>
    </div>
  );
}
