import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, ArrowLeft, Lock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { mockUsers, AVAILABILITY_LABELS } from "@/data/mockData";

export default function ChatRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { chatSessions, chatMessages, adminProfiles, addChatMessage, markMessagesRead } = useData();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const session = chatSessions.find((s) => s.id === sessionId);
  const messages = chatMessages
    .filter((m) => m.session_id === sessionId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Determine the other party
  const isClosed = session?.status === "CLOSED";
  const otherUserId = user && session
    ? user.id === session.user_id
      ? session.assigned_admin_id
      : session.user_id
    : null;
  const otherUser = otherUserId ? mockUsers.find((u) => u.id === otherUserId) : null;
  const otherProfile = otherUserId ? adminProfiles.find((p) => p.user_id === otherUserId) : null;

  // Mark messages as read when opening
  useEffect(() => {
    if (user && sessionId) {
      markMessagesRead(sessionId, user.id);
    }
  }, [user, sessionId, messages.length, markMessagesRead]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (!user || !session) {
    return (
      <div className="animate-fade-in text-center py-20">
        <p className="text-muted-foreground">Sesi chat tidak ditemukan.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/chat")}>
          Kembali
        </Button>
      </div>
    );
  }

  const sendMessage = () => {
    if (!input.trim() || isClosed) return;
    addChatMessage(session.id, user.id, input.trim());
    setInput("");
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in h-[calc(100vh-8rem)]">
      <Card className="flex flex-col h-full">
        {/* Header */}
        <CardHeader className="border-b py-3 px-4 flex flex-row items-center gap-3 space-y-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {otherUser ? otherUser.name.slice(0, 2).toUpperCase() : "HP"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">
              {otherUser ? otherUser.name : "Menunggu admin..."}
            </h3>
            <div className="flex items-center gap-1.5">
              {otherProfile ? (
                <>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      otherProfile.availability_status === "ONLINE" ? "bg-green-500" :
                      otherProfile.availability_status === "AWAY" ? "bg-yellow-500" : "bg-gray-400"
                    }`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {AVAILABILITY_LABELS[otherProfile.availability_status]}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {isClosed ? "Sesi ditutup" : "Menunggu..."}
                </span>
              )}
            </div>
          </div>
          {isClosed && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Lock className="h-3 w-3" /> Ditutup
            </Badge>
          )}
        </CardHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Belum ada pesan. Mulai percakapan!
              </p>
            )}
            {messages.map((msg) => {
              const isMine = msg.sender_id === user.id;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] ${isMine ? "chat-bubble-sender" : "chat-bubble-receiver"}`}>
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
        {isClosed ? (
          <CardContent className="border-t p-3">
            <p className="text-xs text-muted-foreground text-center py-2">
              Sesi chat ini telah ditutup. Anda masih dapat membaca riwayat pesan.
            </p>
          </CardContent>
        ) : (
          <CardContent className="border-t p-3">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ketik pesan..."
                className="flex-1"
              />
              <Button size="icon" onClick={sendMessage} disabled={!input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
