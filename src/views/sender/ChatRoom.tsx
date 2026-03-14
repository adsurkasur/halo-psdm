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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import { compressImageForUpload, isCompressibleImage } from "@/lib/upload-compression";
import { getChatMessagePreview, getTransformedPublicImageUrl, isVideoResource } from "@/lib/supabase-storage";
import { MediaViewerDialog } from "@/components/shared/MediaViewerDialog";
import { AVAILABILITY_LABELS, type ChatMessageType } from "@/data/domain";

const MAX_MEDIA_SIZE = 10 * 1024 * 1024;

export default function ChatRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, allUsers } = useAuth();
  const { chatSessions, chatMessages, adminProfiles, addChatMessage, markMessagesRead } = useData();

  const [input, setInput] = useState("");
  const [mediaPreview, setMediaPreview] = useState<{ url: string; name: string; type: ChatMessageType; file: File } | null>(null);
  const [mediaCompressionInfo, setMediaCompressionInfo] = useState<{ original: number; compressed: number } | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
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
      try {
        setSendingMedia(true);

        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
        }

        const formData = new FormData();
        formData.append("sessionId", session.id);
        formData.append("media", mediaPreview.file);

        const response = await fetch("/api/secure/chat/media", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        });

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          media_url?: string;
          media_name?: string;
        };

        if (!response.ok || !payload.media_url) {
          throw new Error(payload.error ?? "Gagal upload media chat.");
        }

        const caption = input.trim();

        await addChatMessage(
          session.id,
          user.id,
          caption,
          mediaPreview.type,
          payload.media_url,
          payload.media_name ?? mediaPreview.name
        );

        URL.revokeObjectURL(mediaPreview.url);
        setMediaPreview(null);
        setMediaCompressionInfo(null);
        setInput("");
      } catch (error) {
        toast({
          title: error instanceof Error ? error.message : "Gagal mengirim media.",
          variant: "destructive",
        });
      } finally {
        setSendingMedia(false);
      }
      return;
    }

    if (!input.trim()) return;
    await addChatMessage(session.id, user.id, input.trim());
    setInput("");
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    let file = selectedFile;
    if (isCompressibleImage(file)) {
      try {
        const optimized = await compressImageForUpload(file, "chat");
        file = optimized.file;
        setMediaCompressionInfo({
          original: optimized.originalSize,
          compressed: optimized.compressedSize,
        });

        if (optimized.compressed) {
          toast({
            title: "Media gambar dioptimalkan",
            description: `${formatBytes(optimized.originalSize)} -> ${formatBytes(optimized.compressedSize)}`,
          });
        }
      } catch {
        setMediaCompressionInfo(null);
        toast({
          title: "Kompresi media dilewati",
          description: "File asli tetap digunakan agar pengiriman tetap berjalan.",
        });
      }
    } else {
      setMediaCompressionInfo(null);
    }

    if (file.size > MAX_MEDIA_SIZE) {
      toast({
        title: "Ukuran file maksimal 10MB.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    const isImage = file.type.startsWith("image/");
    const url = URL.createObjectURL(file);

    setMediaPreview({
      url,
      name: file.name,
      type: isImage ? "IMAGE" : "FILE",
      file,
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
                        <MediaViewerDialog
                          mediaUrl={msg.media_url}
                          mediaName={msg.media_name}
                          mediaMime="image/*"
                          title="Pratinjau Gambar Chat"
                        >
                          <img
                            src={getTransformedPublicImageUrl(msg.media_url, {
                              width: 1080,
                              quality: 76,
                              resize: "contain",
                            })}
                            alt={msg.media_name ?? "Image"}
                            className="rounded-lg max-w-full max-h-60 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </MediaViewerDialog>
                      </div>
                    )}
                    {msg.type === "FILE" && msg.media_url && (
                      <div className="mb-2">
                        {isVideoResource(undefined, msg.media_name, msg.media_url) ? (
                          <MediaViewerDialog
                            mediaUrl={msg.media_url}
                            mediaName={msg.media_name}
                            mediaMime="video/*"
                            title="Pratinjau Video Chat"
                          >
                            <video
                              src={msg.media_url}
                              className="rounded-lg max-w-full max-h-60 bg-black"
                              controls
                              preload="metadata"
                            >
                              Browser Anda tidak mendukung pemutar video.
                            </video>
                          </MediaViewerDialog>
                        ) : (
                          <MediaViewerDialog
                            mediaUrl={msg.media_url}
                            mediaName={msg.media_name}
                            title="Pratinjau Lampiran Chat"
                          >
                            <div className={`flex items-center gap-2 p-2 rounded-lg ${isMine ? "bg-white/10" : "bg-background"}`}>
                              <Paperclip className="h-4 w-4 shrink-0" />
                              <span className="text-xs truncate">{msg.media_name ?? getChatMessagePreview(msg)}</span>
                            </div>
                          </MediaViewerDialog>
                        )}
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
                  {mediaCompressionInfo && (
                    <p className="text-[10px] text-muted-foreground">
                      Rasio kompresi: {Math.max(0, Math.round((1 - mediaCompressionInfo.compressed / mediaCompressionInfo.original) * 100))}%
                      ({formatBytes(mediaCompressionInfo.original)} {"->"} {formatBytes(mediaCompressionInfo.compressed)})
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => {
                    URL.revokeObjectURL(mediaPreview.url);
                    setMediaPreview(null);
                    setMediaCompressionInfo(null);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
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
                disabled={sendingMedia || (!input.trim() && !mediaPreview)}
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
