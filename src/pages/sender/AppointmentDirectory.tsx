import { Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { mockAdminProfiles } from "@/data/mockData";

export default function AppointmentDirectory() {
  const { toast } = useToast();

  const handleContact = (name: string) => {
    toast({
      title: "Mengalihkan ke WhatsApp",
      description: `"Halo Kak ${name}, saya ingin mengajukan janji temu melalui Halo PSDM."`,
    });
  };

  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-xl font-bold">Order Janji Temu</h1>
      <p className="text-sm text-muted-foreground">Pilih admin untuk mengajukan janji temu via WhatsApp</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {mockAdminProfiles.map((admin) => (
          <Card key={admin.id} className="hover:shadow-md transition-shadow">
            <CardContent className="py-6 flex flex-col items-center text-center gap-3">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                  {admin.avatar}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{admin.name}</h3>
                <p className="text-xs text-muted-foreground">{admin.jabatan}</p>
              </div>
              <Badge className={`${admin.online ? "bg-online" : "bg-offline"} text-primary-foreground text-xs`}>
                {admin.online ? "Online" : "Offline"}
              </Badge>
              <Button
                className="w-full mt-2 gap-2"
                variant={admin.online ? "default" : "secondary"}
                onClick={() => handleContact(admin.name)}
              >
                <Phone className="h-4 w-4" />
                Hubungi via WhatsApp
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
