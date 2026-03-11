import { Bell } from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  const { role, setRole, isAdmin } = useRole();

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="mr-1" />
        <span className="font-bold text-lg tracking-tight text-primary">Halo PSDM</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Role Switcher */}
        <div className="flex items-center gap-2 bg-muted rounded-full px-3 py-1.5 text-xs font-medium">
          <span className={!isAdmin ? "text-primary font-semibold" : "text-muted-foreground"}>Sender</span>
          <Switch
            checked={isAdmin}
            onCheckedChange={(checked) => setRole(checked ? "admin" : "sender")}
            className="data-[state=checked]:bg-primary"
          />
          <span className={isAdmin ? "text-primary font-semibold" : "text-muted-foreground"}>Admin</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground border-2 border-card">
            3
          </Badge>
        </button>

        {/* Avatar */}
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
            {isAdmin ? "SA" : "AS"}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
