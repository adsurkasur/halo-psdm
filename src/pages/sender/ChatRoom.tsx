import { useState } from "react";
import { Send } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mockChatMessages, type ChatMessage } from "@/data/mockData";
import { useRole } from "@/contexts/RoleContext";

export default function ChatRoom() {
  const { isAdmin } = useRole();
  const [messages, setMessages] = useState<ChatMessage[]>(mockChatMessages);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMsg: ChatMessage = {
      id: String(Date.now()),
      sender: isAdmin ? "admin" : "user",
      text: input,
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      read: false,
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in h-[calc(100vh-8rem)]">
      <Card className="flex flex-col h-full">
        {/* Chat Header */}
        <CardHeader className="border-b py-3 px-4 flex flex-row items-center gap-3 space-y-0">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {isAdmin ? "AS" : "SA"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">
              {isAdmin ? "Ade Surya Ananda" : "Kak Sarah - PH PSDM"}
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-online" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </CardHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {messages.map((msg) => {
              const isMine = (isAdmin && msg.sender === "admin") || (!isAdmin && msg.sender === "user");
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] ${isMine ? "chat-bubble-sender" : "chat-bubble-receiver"}`}>
                    <p className="text-sm">{msg.text}</p>
                    <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                      <span className="text-[10px] opacity-70">{msg.time}</span>
                      {isMine && (
                        <span className="text-[10px] opacity-70">{msg.read ? "✓✓" : "✓"}</span>
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
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ketik pesan..."
              className="flex-1"
            />
            <Button size="icon" onClick={sendMessage}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
