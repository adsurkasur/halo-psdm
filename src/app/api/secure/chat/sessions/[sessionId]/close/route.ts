import { NextResponse } from "next/server";
import { forbidden, requireAuthContext } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  if (auth.context.appUser.role !== "PH" && auth.context.appUser.role !== "HR") {
    return forbidden();
  }

  const { sessionId } = await params;
  const { data: session, error: fetchError } = await supabaseServer
    .from("chat_sessions")
    .select("id, user_id, assigned_admin_id, status, closed_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (fetchError || !session) {
    return NextResponse.json({ error: "Session tidak ditemukan." }, { status: 404 });
  }

  if (session.assigned_admin_id !== auth.context.appUser.id) {
    return forbidden("Sesi hanya dapat ditutup oleh PH/HR yang menangani sesi tersebut.");
  }

  if (session.status === "CLOSED") {
    return NextResponse.json({ ok: true, closed_at: session.closed_at });
  }

  const closed = await supabaseServer.rpc("close_chat_session_retained", {
    p_session_id: sessionId,
    p_actor_user_id: auth.context.appUser.id,
    p_actor_name: auth.context.appUser.name,
  });

  if (closed.error) {
    return NextResponse.json({ error: closed.error.message }, { status: 400 });
  }

  const closedSession = closed.data as { closed_at?: string | null } | null;
  const closedAt = closedSession?.closed_at ?? new Date().toISOString();

  if (session.user_id) {
    await supabaseServer.from("notifications").insert({
      id: crypto.randomUUID(),
      user_id: session.user_id,
      session_id: session.id,
      type: "SESSION_CLOSED",
      payload: {
        title: "Sesi Chat Ditutup",
        message: `Sesi chat ditutup oleh ${auth.context.appUser.name}`,
        link: `/chat/${session.id}`,
      },
      is_read: false,
      created_at: closedAt,
    });
  }

  return NextResponse.json({ ok: true, closed_at: closedAt });
}
