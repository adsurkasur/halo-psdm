import { useState, useEffect, useRef } from "react";
import { Send, Lock, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { AVAILABILITY_LABELS, type AvailabilityStatus } from "@/data/domain";

export default function AdminChatQueue() {
  const { toast } = useToast();
  const { user, allUsers } = useAuth();
  const {
    chatSessions,
    chatMessages,
    adminProfiles,
    assignAdminToSession,
    closeChatSession,
    addChatMessage,
    markMessagesRead,
    updateAvailability,
  } = useData();

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const myProfile = adminProfiles.find((p) => p.user_id === user.id);
  const adminStatus = myProfile?.availability_status ?? "ONLINE";

  const openSessions = chatSessions
    .filter((s) => s.status === "OPEN")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const selectedSession = openSessions.find((s) => s.id === selectedSessionId) ?? openSessions[0] ?? null;
  const sessionMessages = selectedSession
    ? chatMessages
        .filter((m) => m.session_id === selectedSession.id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : [];

  // Auto-select first session
  useEffect(() => {
    if (!selectedSessionId && openSessions.length > 0) {
      setSelectedSessionId(openSessions[0].id);
    }
  }, [openSessions, selectedSessionId]);

  // Mark messages read when selecting a session
  useEffect(() => {
    if (selectedSession && user) {
      void markMessagesRead(selectedSession.id, user.id);
    }
  }, [selectedSession, sessionMessages.length, user, markMessagesRead]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sessionMessages.length]);

  const handleAssign = async (sessionId: string) => {
    await assignAdminToSession(sessionId, user.id);
    toast({ title: "Berhasil", description: "Anda telah mengambil sesi ini." });
  };

  const handleCloseSession = async () => {
    if (!selectedSession) return;
    await closeChatSession(selectedSession.id);
    setSelectedSessionId(null);
    toast({ title: "Sesi Ditutup", description: "Sesi chat telah berhasil ditutup." });
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedSession) return;
    await addChatMessage(selectedSession.id, user.id, input.trim());
    setInput("");
  };

  if (!user) return null;

  return (
    <div className="animate-fade-in h-[calc(100vh-8rem)]">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        {/* Left: Chat List */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader className="py-3 px-4 border-b space-y-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Antrean Chat</h3>
              <Select
                value={adminStatus}
                onValueChange={(v) => void updateAvailability(user.id, v as AvailabilityStatus)}
              >
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONLINE">🟢 Online</SelectItem>
                  <SelectItem value="AWAY">🟡 Sibuk</SelectItem>
                  <SelectItem value="OFFLINE">⚫ Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            <CardContent className="p-2 space-y-1">
              {openSessions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Tidak ada sesi chat aktif.
                </p>
              ) : (
                openSessions.map((session) => {
                  const sender = allUsers.find((u) => u.id === session.user_id);
                  const senderName = sender?.name ?? "Pengirim";
                  const msgs = chatMessages.filter((m) => m.session_id === session.id);
                  const lastMsg = msgs[msgs.length - 1];
                  const unreadCount = msgs.filter(
                    (m) => m.sender_id !== user.id && !m.is_read
                  ).length;
                  const isAssigned = session.assigned_admin_id === user.id;
                  const isUnassigned = !session.assigned_admin_id;

                  return (
                    <button
                      key={session.id}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        selectedSession?.id === session.id ? "bg-accent" : "hover:bg-muted"
                      }`}
                      onClick={() => setSelectedSessionId(session.id)}
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {senderName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className={`text-sm truncate ${unreadCount > 0 ? "font-bold" : "font-medium"}`}>
                            {senderName}
                          </p>
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                            {lastMsg
                              ? new Date(lastMsg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                              : ""}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {lastMsg?.content ?? "Belum ada pesan"}
                        </p>
                        {isUnassigned && (
                          <Badge variant="secondary" className="text-[9px] mt-1">Belum diassign</Badge>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <Badge className="bg-destructive text-destructive-foreground h-5 w-5 p-0 flex items-center justify-center text-[10px] shrink-0">
                          {unreadCount}
                        </Badge>
                      )}
                    </button>
                  );
                })
              )}
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Right: Chat Room */}
        <div className="lg:col-span-2 flex flex-col h-full">
          {!selectedSession ? (
            <Card className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Pilih sesi chat dari daftar di kiri.</p>
            </Card>
          ) : (
            <Card className="flex flex-col h-full">
              {/* Header */}
              <CardHeader className="border-b py-3 px-4 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {(allUsers.find((u) => u.id === selectedSession.user_id)?.name ?? "Pengirim").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-sm">
                      {allUsers.find((u) => u.id === selectedSession.user_id)?.name ?? "Pengirim"}
                    </h3>
                    {selectedSession.report_id && (
                      <p className="text-[10px] text-muted-foreground">Klarifikasi laporan terkait</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!selectedSession.assigned_admin_id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={() => handleAssign(selectedSession.id)}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Ambil Kasus
                    </Button>
                  ) : selectedSession.assigned_admin_id === user.id ? (
                    <Button size="sm" variant="destructive" className="text-xs" onClick={handleCloseSession}>
                      Tutup Sesi
                    </Button>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Ditangani: {allUsers.find((u) => u.id === selectedSession.assigned_admin_id)?.name}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-3">
                  {sessionMessages.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      Belum ada pesan di sesi ini.
                    </p>
                  )}
                  {sessionMessages.map((msg) => {
                    const isMine = msg.sender_id === user.id;
                    const msgSender = allUsers.find((u) => u.id === msg.sender_id);
                    return (
                      <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] ${isMine ? "chat-bubble-sender" : "chat-bubble-receiver"}`}>
                          {!isMine && (
                            <p className="text-[10px] font-medium opacity-70 mb-0.5">{msgSender?.name}</p>
                          )}
                          <p className="text-sm">{msg.content}</p>
                          <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                            <span className="text-[10px] opacity-70">
                              {new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {isMine && (
                              <span className="text-[10px] opacity-70">{msg.is_read ? "✓✓" : "✓"}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Input */}
              <CardContent className="border-t p-3">
                {!selectedSession.assigned_admin_id ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Ambil kasus ini terlebih dahulu untuk membalas pesan.
                  </p>
                ) : selectedSession.assigned_admin_id !== user.id ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Sesi ini ditangani oleh admin lain.
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Ketik balasan..."
                      className="flex-1"
                    />
                    <Button size="icon" onClick={sendMessage} disabled={!input.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
