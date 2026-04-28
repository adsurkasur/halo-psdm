import { Bell, LogOut, Check, Sun, Moon, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { JABATAN_LABELS } from "@/data/domain";
import { UserAvatarWithPreview } from "@/components/shared/UserAvatarWithPreview";

export function AppHeader() {
  const { user, logout } = useAuth();
  const { updateAvailability, notifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } = useData();
  const navigate = useNavigate();
  const { resolvedTheme, theme, setTheme } = useTheme();

  if (!user) return null;

  const unreadCount = getUnreadCount(user.id);
  const userNotifs = notifications
    .filter((n) => n.user_id === user.id)
    .slice(0, 20);

  const handleLogout = async () => {
    if (user.role === "HR" || user.role === "PH") {
      try {
        await updateAvailability(user.id, "OFFLINE");
      } catch (err) {
        console.error("Failed to set offline status on logout:", err);
      }
    }
    logout();
    navigate("/login");
  };

  const roleBadge = user.role === "MEMBER"
    ? { label: "Sender", cls: "bg-blue-100 text-blue-700" }
    : user.role === "HR"
    ? { label: "HR", cls: "bg-orange-100 text-orange-700" }
    : { label: "PH", cls: "bg-purple-100 text-purple-700" };

  const isDark = resolvedTheme === "dark";

  const handleToggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="mr-1" />
        <Link to="/" className="font-bold text-lg tracking-tight text-primary hover:opacity-80 transition-opacity">
          Halo PSDM
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {/* Role Badge */}
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full hidden sm:inline-block ${roleBadge.cls}`}>
          {roleBadge.label}
        </span>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground border-2 border-card">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h4 className="text-sm font-semibold">Notifikasi</h4>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 gap-1"
                  onClick={() => void markAllNotificationsRead(user.id)}
                >
                  <Check className="h-3 w-3" />
                  Tandai semua
                </Button>
              )}
            </div>
            <ScrollArea className="h-[320px]">
              {userNotifs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Belum ada notifikasi
                </p>
              ) : (
                <div className="divide-y">
                  {userNotifs.map((n) => (
                    <button
                      key={n.id}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                        !n.is_read ? "bg-accent/30" : ""
                      }`}
                      onClick={() => {
                        void markNotificationRead(n.id);
                        if (n.link) navigate(n.link);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        {!n.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs ${!n.is_read ? "font-semibold" : "font-medium"}`}>
                            {n.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                            {formatTimeAgo(n.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Profile card with popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-start gap-2" aria-label="Pengaturan Akun">
              <UserAvatarWithPreview
                name={user.name}
                avatarUrl={user.avatar_url}
                sizeClassName="h-8 w-8"
                fallbackClassName="bg-primary text-primary-foreground text-xs font-semibold"
                modalTitle="Foto Profil Anda"
                disablePreview
              />
              <div className="hidden md:block">
                <p className="text-xs font-medium leading-none">{user.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {JABATAN_LABELS[user.jabatan]}
                </p>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-2">
            <div className="flex flex-col space-y-1">
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={handleToggleTheme}
              >
                {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                {isDark ? "Light Mode" : "Dark Mode"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => navigate("/profile")}
              >
                <Settings className="mr-2 h-4 w-4" />
                Pengaturan Akun
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Keluar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}
