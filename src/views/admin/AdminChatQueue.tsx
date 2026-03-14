import { useState, useEffect, useRef } from "react";
import { Send, Lock, UserPlus, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { AVAILABILITY_LABELS, type AvailabilityStatus } from "@/data/domain";
import { UserAvatarWithPreview } from "@/components/shared/UserAvatarWithPreview";
import { supabase } from "@/lib/supabase/client";
import { compressImageForUpload, isCompressibleImage } from "@/lib/upload-compression";
import { getChatMessagePreview, getTransformedPublicImageUrl, isVideoResource } from "@/lib/supabase-storage";
import { MediaViewerDialog } from "@/components/shared/MediaViewerDialog";

const MAX_MEDIA_SIZE = 10 * 1024 * 1024;

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
  const [mediaPreview, setMediaPreview] = useState<{ url: string; name: string; type: "IMAGE" | "FILE"; file: File } | null>(null);
  const [mediaCompressionInfo, setMediaCompressionInfo] = useState<{ original: number; compressed: number } | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!selectedSession || !user) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void markMessagesRead(selectedSession.id, user.id);
    }, 1500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [markMessagesRead, selectedSession, user]);

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
    if (!selectedSession) return;

    if (mediaPreview) {
      try {
        setSendingMedia(true);

        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
        }

        const formData = new FormData();
        formData.append("sessionId", selectedSession.id);
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
          selectedSession.id,
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
    await addChatMessage(selectedSession.id, user.id, input.trim());
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
      toast({ title: "Ukuran file maksimal 10MB.", variant: "destructive" });
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

    e.target.value = "";
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
                <SelectTrigger className="w-[176px] min-w-[176px] h-7 text-xs [&>span]:line-clamp-none [&>span]:whitespace-nowrap">
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
                    <div
                      key={session.id}
                      data-testid={`admin-chat-session-${session.id}`}
                      data-report-id={session.report_id ?? ""}
                      role="button"
                      tabIndex={0}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        selectedSession?.id === session.id ? "bg-accent" : "hover:bg-muted"
                      }`}
                      onClick={() => setSelectedSessionId(session.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedSessionId(session.id);
                        }
                      }}
                    >
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <UserAvatarWithPreview
                          name={senderName}
                          avatarUrl={sender?.avatar_url}
                          sizeClassName="h-9 w-9"
                          fallbackClassName="bg-primary text-primary-foreground text-xs"
                          modalTitle="Foto Profil Pengirim"
                        />
                      </div>
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
                          {lastMsg ? getChatMessagePreview(lastMsg) : "Belum ada pesan"}
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
                    </div>
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
                  <UserAvatarWithPreview
                    name={allUsers.find((u) => u.id === selectedSession.user_id)?.name ?? "Pengirim"}
                    avatarUrl={allUsers.find((u) => u.id === selectedSession.user_id)?.avatar_url}
                    sizeClassName="h-9 w-9"
                    fallbackClassName="bg-primary text-primary-foreground text-xs"
                    modalTitle="Foto Profil Pengirim"
                  />
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
                                    controls
                                    preload="metadata"
                                    className="rounded-lg max-w-full max-h-60 bg-black"
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
                  <div className="space-y-2">
                    {mediaPreview && (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg animate-scale-in">
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
                      data-testid="admin-chat-input"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Ketik balasan..."
                      className="flex-1"
                    />
                    <Button data-testid="admin-chat-send" size="icon" onClick={sendMessage} disabled={sendingMedia || (!input.trim() && !mediaPreview)}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
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
