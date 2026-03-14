import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    sessionId: string;
    content: string;
    type?: "TEXT" | "IMAGE" | "FILE";
    mediaUrl?: string;
    mediaName?: string;
  };

  const { data: session } = await supabaseServer
    .from("chat_sessions")
    .select("id, user_id, assigned_admin_id")
    .eq("id", body.sessionId)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "Session tidak ditemukan." }, { status: 404 });
  }

  const isSender = auth.context.appUser.id === session.user_id;
  const isAssignedAdmin = session.assigned_admin_id === auth.context.appUser.id;
  const isAdminRole = ["ADMIN", "SUPER_ADMIN"].includes(auth.context.appUser.role);

  if (!isSender && !isAssignedAdmin && !isAdminRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const message = {
    id: `cm_${crypto.randomUUID()}`,
    session_id: body.sessionId,
    sender_id: auth.context.appUser.id,
    content: body.content,
    type: body.type ?? "TEXT",
    media_url: body.mediaUrl,
    media_name: body.mediaName,
    is_read: false,
    read_at: null,
    created_at: now,
  };

  const inserted = await supabaseServer.from("chat_messages").insert(message);
  if (inserted.error) {
    return NextResponse.json({ error: inserted.error.message }, { status: 400 });
  }

  const targetUserId = isSender ? session.assigned_admin_id : session.user_id;
  if (targetUserId) {
    const preview = message.type === "TEXT" ? body.content.slice(0, 60) : `📎 ${body.mediaName ?? "Media"}`;
    await supabaseServer.from("notifications").insert({
      id: `n_${crypto.randomUUID()}`,
      user_id: targetUserId,
      type: isSender ? "NEW_CHAT_MESSAGE" : "NEW_CHAT_REPLY",
      payload: {
        title: isSender ? "Pesan Baru" : "Balasan Chat",
        message: `${auth.context.appUser.name}: ${preview}${message.type === "TEXT" && body.content.length > 60 ? "..." : ""}`,
        link: isSender ? "/admin/chat" : `/chat/${body.sessionId}`,
      },
      is_read: false,
      created_at: now,
    });
  }

  return NextResponse.json({ message });
}
