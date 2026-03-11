import { LayoutDashboard, FileText, MessageCircle, Calendar, ClipboardList, MessagesSquare } from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import { NavLink } from "@/components/NavLink";
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

const senderNav = [
  { title: "Dasbor", url: "/", icon: LayoutDashboard },
  { title: "Pelaporan Saya", url: "/laporan/buat", icon: FileText },
  { title: "Ruang Curhat", url: "/chat/room", icon: MessageCircle },
  { title: "Janji Temu", url: "/janji-temu", icon: Calendar },
];

const adminNav = [
  { title: "Dasbor Admin", url: "/admin/dasbor", icon: LayoutDashboard },
  { title: "Kelola Laporan", url: "/admin/laporan", icon: ClipboardList },
  { title: "Antrean Chat", url: "/admin/chat", icon: MessagesSquare },
];

export function AppSidebar() {
  const { isSender } = useRole();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const items = isSender ? senderNav : adminNav;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">
            {!collapsed && (isSender ? "Menu Anggota" : "Menu Admin")}
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
                      {!collapsed && <span>{item.title}</span>}
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
