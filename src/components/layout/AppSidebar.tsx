import { LayoutDashboard, FileText, MessageCircle, Calendar, ClipboardList, MessagesSquare, BarChart3, Users, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { user, isSender, isPh } = useAuth();
  const { chatSessions, reports, getUnreadCount } = useData();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  if (!user) return null;

  // Compute badge counts
  const openChatsCount = chatSessions.filter(
    (s) => s.status === "OPEN" && (isSender ? s.user_id === user.id : true)
  ).length;
  const pendingReportsCount = isPh
    ? reports.filter((r) => r.status === "RECEIVED").length
    : 0;

  const senderNav = [
    { title: "Dasbor", url: "/", icon: LayoutDashboard, badge: 0 },
    { title: "Laporan Saya", url: "/laporan", icon: FileText, badge: 0 },
    { title: "Ruang Curhat", url: "/chat", icon: MessageCircle, badge: openChatsCount },
    { title: "Janji Temu", url: "/janji-temu", icon: Calendar, badge: 0 },
  ];

  const adminNav = [
    { title: "Dasbor PH", url: "/admin/dasbor", icon: LayoutDashboard, badge: 0 },
    { title: "Kelola Laporan", url: "/admin/laporan", icon: ClipboardList, badge: pendingReportsCount },
    { title: "Antrean Chat", url: "/admin/chat", icon: MessagesSquare, badge: openChatsCount },
    { title: "Janji Temu", url: "/janji-temu", icon: Calendar, badge: 0 },
    ...(isPh
      ? [
          { title: "Tracking Janji Temu", url: "/admin/janji-temu", icon: ClipboardList, badge: 0 },
          { title: "Rekap & Analitik", url: "/admin/rekap", icon: BarChart3, badge: 0 },
        { title: "Kelola HR dan PH", url: "/admin/kelola-admin", icon: Users, badge: 0 },
        ]
      : []),
  ];

  const items = isSender ? [...senderNav] : isPh ? [...adminNav] : [...senderNav];

  // always offer profile/settings link at bottom
  items.push({ title: "Profil Saya", url: "/profile", icon: User, badge: 0 });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">
            {!collapsed && (isPh ? "Menu PH" : "Menu Anggota")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/" || item.url === "/admin/dasbor"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span className="flex-1">{item.title}</span>}
                      {!collapsed && item.badge > 0 && (
                        <Badge className="bg-destructive text-destructive-foreground h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[10px] ml-auto">
                          {item.badge}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
