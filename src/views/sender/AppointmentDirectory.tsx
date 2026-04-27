import { useState } from "react";
import { Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { AVAILABILITY_LABELS, type AdminProfile } from "@/data/domain";
import { isValidPhone62, normalizePhoneTo62 } from "@/lib/phone";

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

  return (
    <div className="container mx-auto p-4 lg:p-8 space-y-6 max-w-5xl">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Janji Temu</h1>
        <p className="text-muted-foreground">Hubungi HR atau PH untuk berkonsultasi secara langsung.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminProfiles
          .filter((p) => p.user_id !== user?.id)
          .map((profile) => {
            const initials = profile.display_name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            const effectiveStatus = getEffectiveStatus(profile);
            const availabilityColor =
              effectiveStatus === "ONLINE"
                ? "bg-green-500"
                : effectiveStatus === "AWAY"
                ? "bg-yellow-500"
                : "bg-gray-400";

            return (
              <Card key={profile.user_id} data-testid={`appointment-target-${profile.user_id}`} className="hover:shadow-md transition-shadow">
                <CardContent className="py-5 space-y-4">
                  {/* Profile */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-14 w-14">
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card ${availabilityColor}`}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">{profile.display_name}</h3>
                      <p className="text-xs text-muted-foreground">{profile.jabatan_display}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${availabilityColor}`} />
                        {AVAILABILITY_LABELS[effectiveStatus]}
                      </p>
                    </div>
                  </div>

                  {/* Contact button */}
                  <Button
                    data-testid={`appointment-contact-${profile.user_id}`}
                    className="w-full gap-2"
                    onClick={() => handleContact(profile)}
                    disabled={processingTargetId !== null}
                  >
                    <Phone className="h-4 w-4" />
                    {processingTargetId === profile.user_id ? "Memproses..." : "Hubungi via WhatsApp"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
