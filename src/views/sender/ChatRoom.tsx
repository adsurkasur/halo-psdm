import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, ArrowLeft, Lock, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { AVAILABILITY_LABELS, type ChatMessageType } from "@/data/domain";

export default function ChatRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user, allUsers } = useAuth();
  const { chatSessions, chatMessages, adminProfiles, addChatMessage, markMessagesRead } = useData();

  const [input, setInput] = useState("");
  const [mediaPreview, setMediaPreview] = useState<{ url: string; name: string; type: ChatMessageType } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const session = chatSessions.find((s) => s.id === sessionId);
  const messages = chatMessages
    .filter((m) => m.session_id === sessionId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const isClosed = session?.status === "CLOSED";
  const otherUserId = user && session
    ? user.id === session.user_id
      ? session.assigned_admin_id
      : session.user_id
    : null;
  const otherUser = otherUserId ? allUsers.find((u) => u.id === otherUserId) : null;
  const otherProfile = otherUserId ? adminProfiles.find((p) => p.user_id === otherUserId) : null;
  const otherDisplayName = otherProfile?.display_name ?? otherUser?.name ?? "Menunggu admin...";

  useEffect(() => {
    if (user && sessionId) {
      void markMessagesRead(sessionId, user.id);
    }
  }, [user, sessionId, messages.length, markMessagesRead]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (!user || !session) {
    return (
      <div className="page-enter text-center py-20">
        <p className="text-muted-foreground">Sesi chat tidak ditemukan.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/chat")}>
          Kembali
        </Button>
      </div>
    );
  }

  const sendMessage = async () => {
    if (isClosed) return;

    if (mediaPreview) {
      await addChatMessage(session.id, user.id, "", mediaPreview.type, mediaPreview.url, mediaPreview.name);
      setMediaPreview(null);
      return;
    }

    if (!input.trim()) return;
    await addChatMessage(session.id, user.id, input.trim());
    setInput("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const url = URL.createObjectURL(file);

    setMediaPreview({
      url: isImage ? url : `https://placehold.co/200x80/f1f5f9/64748b?text=${encodeURIComponent(file.name)}`,
      name: file.name,
      type: isImage ? "IMAGE" : "FILE",
    });

    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  return (
    <div className="max-w-2xl mx-auto page-enter h-[calc(100vh-8rem)]">
      <Card className="flex flex-col h-full animate-scale-in">
        {/* Header */}
        <CardHeader className="border-b py-3 px-4 flex flex-row items-center gap-3 space-y-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 transition-transform duration-200 hover:scale-105" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {otherDisplayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">
              {otherDisplayName}
            </h3>
            <div className="flex items-center gap-1.5">
              {otherProfile ? (
                <>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      otherProfile.availability_status === "ONLINE" ? "bg-green-500 animate-pulse-glow" :
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
              <p className="text-center text-sm text-muted-foreground py-8 animate-fade-in">
                Belum ada pesan. Mulai percakapan!
              </p>
            )}
            {messages.map((msg) => {
              const isMine = msg.sender_id === user.id;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} ${isMine ? "animate-chat-in-right" : "animate-chat-in-left"}`}>
                  <div className={`max-w-[75%] ${isMine ? "chat-bubble-sender" : "chat-bubble-receiver"}`}>
                    {/* Media content */}
                    {msg.type === "IMAGE" && msg.media_url && (
                      <div className="mb-2">
                        <img
                          src={msg.media_url}
                          alt={msg.media_name ?? "Image"}
                          className="rounded-lg max-w-full max-h-60 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(msg.media_url, "_blank")}
                        />
                      </div>
                    )}
                    {msg.type === "FILE" && msg.media_name && (
                      <div className={`mb-2 flex items-center gap-2 p-2 rounded-lg ${isMine ? "bg-white/10" : "bg-background"}`}>
                        <Paperclip className="h-4 w-4 shrink-0" />
                        <span className="text-xs truncate">{msg.media_name}</span>
                      </div>
                    )}
                    {/* Text content */}
                    {msg.content && <p className="text-sm">{msg.content}</p>}
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
            {/* Media Preview */}
            {mediaPreview && (
              <div className="mb-2 flex items-center gap-2 p-2 bg-muted rounded-lg animate-scale-in">
                {mediaPreview.type === "IMAGE" ? (
                  <img src={mediaPreview.url} alt={mediaPreview.name} className="h-12 w-12 rounded object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded bg-background flex items-center justify-center">
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{mediaPreview.name}</p>
                  <p className="text-[10px] text-muted-foreground">{mediaPreview.type === "IMAGE" ? "Gambar" : "File"}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setMediaPreview(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 transition-transform duration-200 hover:scale-110"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ketik pesan..."
                className="flex-1 transition-all duration-200 focus:shadow-md"
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={!input.trim() && !mediaPreview}
                className="transition-transform duration-200 hover:scale-105"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
