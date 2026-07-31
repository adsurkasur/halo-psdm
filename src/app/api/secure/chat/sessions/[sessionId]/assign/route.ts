import { NextResponse } from "next/server";
import { forbidden, requireAuthContext } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  if (auth.context.appUser.role !== "PH" && auth.context.appUser.role !== "HR") {
    return forbidden();
  }

  const body = (await request.json().catch(() => ({}))) as { adminId?: string };
  if (body.adminId && body.adminId !== auth.context.appUser.id) {
    return forbidden("Anda hanya dapat mengambil sesi untuk diri sendiri.");
  }

  const { sessionId } = await params;
  const assigned = await supabaseServer.rpc("assign_chat_session_retained", {
    p_session_id: sessionId,
    p_actor_user_id: auth.context.appUser.id,
    p_actor_name: auth.context.appUser.name,
  });

  if (assigned.error) {
    return NextResponse.json({ error: assigned.error.message }, { status: 400 });
  }

  return NextResponse.json({ session: assigned.data });
}
