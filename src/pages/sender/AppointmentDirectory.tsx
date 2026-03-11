import { Phone, Clock, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { mockAdminProfiles } from "@/data/mockData";

export default function AppointmentDirectory() {
  const { toast } = useToast();

  const handleContact = (name: string, day: string, time: string) => {
    toast({
      title: "Mengalihkan ke WhatsApp",
      description: `"Halo Kak ${name}, saya ingin mengajukan janji temu pada ${day} pukul ${time} melalui Halo PSDM."`,
    });
  };

  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-xl font-bold">Order Janji Temu</h1>
      <p className="text-sm text-muted-foreground">Pilih admin dan jadwal yang tersedia untuk mengajukan janji temu</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
        {mockAdminProfiles.map((admin) => (
          <Card key={admin.id} className="hover:shadow-md transition-shadow">
            <CardContent className="py-5 space-y-4">
              {/* Profile header */}
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                    {admin.avatar}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-base">{admin.name}</h3>
                  <p className="text-xs text-muted-foreground">{admin.jabatan}</p>
                </div>
              </div>

              {/* Schedule */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  Jadwal Tersedia
                </div>
                <div className="space-y-2">
                  {admin.schedule.map((slot, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{slot.day}</span>
                        <span className="text-muted-foreground">{slot.time}</span>
                      </div>
                      {slot.available ? (
                        <Button
                          size="sm"
                          className="gap-1.5 h-8 text-xs"
                          onClick={() => handleContact(admin.name, slot.day, slot.time)}
                        >
                          <Phone className="h-3.5 w-3.5" />
                          Hubungi
                        </Button>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Penuh
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
