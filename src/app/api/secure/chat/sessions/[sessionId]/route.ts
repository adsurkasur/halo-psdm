import { NextResponse } from "next/server";
import { forbidden, requireAuthContext } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  const { sessionId } = await params;
  const { data: session, error: fetchError } = await supabaseServer
    .from("chat_sessions")
    .select("id, user_id, assigned_admin_id, status, hidden_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (fetchError || !session) {
    return NextResponse.json({ error: "Sesi chat tidak ditemukan." }, { status: 404 });
  }

  const actor = auth.context.appUser;
  const isOwner = session.user_id === actor.id;
  const isAssignedAdmin = session.assigned_admin_id === actor.id;
  const isOversightRole = actor.role === "PH" || actor.role === "HR";

  if (!isOwner && !isAssignedAdmin && !isOversightRole) {
    return forbidden("Anda tidak memiliki akses untuk menyembunyikan sesi ini.");
  }

  if (session.status !== "CLOSED") {
    return NextResponse.json(
      { error: "Sesi aktif tidak dapat disembunyikan. Tutup sesi terlebih dahulu." },
      { status: 409 },
    );
  }

  if (session.hidden_at) {
    return NextResponse.json({ success: true, softDeleted: true });
  }

  const hidden = await supabaseServer.rpc("hide_chat_session_retained", {
    p_session_id: sessionId,
    p_actor_user_id: actor.id,
    p_actor_name: actor.name,
    p_reason: "Hidden from regular chat lists",
  });

  if (hidden.error) {
    return NextResponse.json({ error: hidden.error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, softDeleted: true });
}
