import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { mockChatSessions } from "@/data/mockData";
import ChatRoom from "@/pages/sender/ChatRoom";

export default function AdminChatQueue() {
  const { toast } = useToast();
  const [selectedSession, setSelectedSession] = useState(mockChatSessions[0].id);
  const [adminStatus, setAdminStatus] = useState("Online");

  const handleCloseSession = () => {
    toast({ title: "Sesi Ditutup", description: "Sesi chat telah berhasil ditutup." });
  };

  return (
    <div className="animate-fade-in h-[calc(100vh-8rem)]">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        {/* Left: Chat List */}
        <Card className="lg:col-span-1">
          <CardHeader className="py-3 px-4 border-b space-y-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Antrean Chat</h3>
              <Select value={adminStatus} onValueChange={setAdminStatus}>
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Sibuk">Sibuk</SelectItem>
                  <SelectItem value="Offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            <CardContent className="p-2 space-y-1">
              {mockChatSessions.map((session) => (
                <button
                  key={session.id}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    selectedSession === session.id ? "bg-accent" : "hover:bg-muted"
                  }`}
                  onClick={() => setSelectedSession(session.id)}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {session.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className={`text-sm truncate ${session.unread > 0 ? "font-bold" : "font-medium"}`}>
                        {session.name}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{session.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{session.lastMessage}</p>
                  </div>
                  {session.unread > 0 && (
                    <Badge className="bg-destructive text-destructive-foreground h-5 w-5 p-0 flex items-center justify-center text-[10px] shrink-0">
                      {session.unread}
                    </Badge>
                  )}
                </button>
              ))}
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Right: Chat Room */}
        <div className="lg:col-span-2 flex flex-col h-full">
          <div className="flex items-center justify-end mb-2">
            <Button size="sm" variant="destructive" onClick={handleCloseSession}>
              Tutup Sesi Chat
            </Button>
          </div>
          <div className="flex-1">
            <ChatRoom />
          </div>
        </div>
      </div>
    </div>
  );
}
