import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  const { sessionId } = await params;

  const { data: session, error: fetchError } = await supabaseServer
    .from("chat_sessions")
    .select("id, user_id, assigned_admin_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (fetchError || !session) {
    return NextResponse.json({ error: "Sesi chat tidak ditemukan." }, { status: 404 });
  }

  const isOwner = auth.context.appUser.id === session.user_id;
  const isAssigned = auth.context.appUser.id === session.assigned_admin_id;
  const isElevated = auth.context.appUser.role === "PH" || auth.context.appUser.role === "HR";

  if (!isOwner && !isAssigned && !isElevated) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete all media files in chat-media storage bucket for this session if any exist
  const { data: messages } = await supabaseServer
    .from("chat_messages")
    .select("media_url")
    .eq("session_id", sessionId)
    .not("media_url", "is", null);

  if (messages && messages.length > 0) {
    const pathsToRemove: string[] = [];
    for (const msg of messages) {
      if (msg.media_url) {
        try {
          const url = new URL(msg.media_url);
          const marker = "/storage/v1/object/public/chat-media/";
          const idx = url.pathname.indexOf(marker);
          if (idx !== -1) {
            pathsToRemove.push(decodeURIComponent(url.pathname.slice(idx + marker.length)));
          }
        } catch {
          // ignore parsing error
        }
      }
    }
    if (pathsToRemove.length > 0) {
      await supabaseServer.storage.from("chat-media").remove(pathsToRemove);
    }
  }

  // Delete chat session (Postgres CASCADE deletes chat_messages)
  const { error: deleteError } = await supabaseServer
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
