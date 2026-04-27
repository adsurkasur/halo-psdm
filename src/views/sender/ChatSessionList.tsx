import { useNavigate } from "react-router-dom";
import { Plus, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatarWithPreview } from "@/components/shared/UserAvatarWithPreview";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { AVAILABILITY_LABELS } from "@/data/domain";
import { useToast } from "@/hooks/use-toast";
import { getChatMessagePreview } from "@/lib/supabase-storage";

export default function ChatSessionList() {
  const navigate = useNavigate();
  const { user, allUsers } = useAuth();
  const { chatSessions, chatMessages, adminProfiles, reports, createChatSession, getEffectiveStatus } = useData();
  const { toast } = useToast();

  if (!user) return null;

  const myReportIds = new Set(reports.filter((r) => r.user_id === user.id).map((r) => r.id));

  const mySessions = chatSessions
    .filter((s) => s.user_id === user.id || (!!s.report_id && myReportIds.has(s.report_id)))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const hasOpenSession = mySessions.some((s) => s.status === "OPEN");

  const handleNewChat = async () => {
    if (hasOpenSession) {
      toast({
        title: "Sesi Aktif",
        description: "Anda sudah memiliki sesi chat yang terbuka. Selesaikan sesi yang ada terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }
    const session = await createChatSession(user.id);
    navigate(`/chat/${session.id}`);
  };

  // Admin availability
  const onlineAdmins = adminProfiles.filter((a) => getEffectiveStatus(a) === "ONLINE");

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ruang Curhat</h1>
        <Button className="gap-2" onClick={handleNewChat}>
          <Plus className="h-4 w-4" />
          Mulai Chat Baru
        </Button>
      </div>

      {/* Admin availability indicator */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                onlineAdmins.length > 0 ? "bg-green-500" : "bg-gray-400"
              }`}
            />
            <span className="text-muted-foreground">
              {onlineAdmins.length > 0
                ? `${onlineAdmins.length} admin sedang online`
                : "Semua admin sedang offline — pesan tetap tersimpan"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Session list */}
      <div className="space-y-2">
        {mySessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Belum ada sesi chat.</p>
              <Button className="mt-4" onClick={handleNewChat}>
                Mulai Chat Pertama
              </Button>
            </CardContent>
          </Card>
        ) : (
          mySessions.map((session) => {
            const msgs = chatMessages.filter((m) => m.session_id === session.id);
            const lastMsg = msgs[msgs.length - 1];
            const unreadCount = msgs.filter((m) => m.sender_id !== user.id && !m.is_read).length;
            const admin = session.assigned_admin_id
              ? allUsers.find((u) => u.id === session.assigned_admin_id)
              : null;
            const adminProfile = session.assigned_admin_id
              ? adminProfiles.find((p) => p.user_id === session.assigned_admin_id)
              : null;
            const adminName = adminProfile?.display_name ?? admin?.name ?? "Menunggu admin...";

            return (
              <Card
                key={session.id}
                data-testid={`chat-session-${session.id}`}
                data-report-id={session.report_id ?? ""}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/chat/${session.id}`)}
              >
                <CardContent className="py-4 flex items-center gap-3">
                  <div className="shrink-0">
                    <UserAvatarWithPreview
                      name={adminName}
                      avatarUrl={adminProfile?.avatar_url ?? admin?.avatar_url ?? null}
                      sizeClassName="h-10 w-10"
                      fallbackClassName="bg-primary text-primary-foreground text-xs"
                      modalTitle="Foto Profil Admin"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">
                        {adminName}
                      </p>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {session.status === "CLOSED" && (
                          <Badge variant="secondary" className="text-[10px]">Ditutup</Badge>
                        )}
                        {unreadCount > 0 && (
                          <Badge className="bg-destructive text-destructive-foreground h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[10px]">
                            {unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {lastMsg ? getChatMessagePreview(lastMsg) : "Belum ada pesan"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {adminProfile && session.status === "OPEN" && (
                        (() => {
                          const effectiveStatus = getEffectiveStatus(adminProfile);
                          return (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                effectiveStatus === "ONLINE" ? "bg-green-500" :
                                effectiveStatus === "AWAY" ? "bg-yellow-500" : "bg-gray-400"
                              }`} />
                              {AVAILABILITY_LABELS[effectiveStatus]}
                            </span>
                          );
                        })()
                      )}
                      {lastMsg && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(lastMsg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
