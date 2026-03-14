import { NextResponse } from "next/server";
import { forbidden, requireAuthContext } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  if (auth.context.appUser.role !== "PH") {
    return forbidden();
  }

  const { sessionId } = await params;
  const { data: session } = await supabaseServer
    .from("chat_sessions")
    .select("id, user_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "Session tidak ditemukan." }, { status: 404 });
  }

  const now = new Date().toISOString();
  await supabaseServer
    .from("chat_sessions")
    .update({ status: "CLOSED", closed_at: now })
    .eq("id", sessionId);

  await supabaseServer.from("notifications").insert({
    id: `n_${crypto.randomUUID()}`,
    user_id: session.user_id,
    type: "SESSION_CLOSED",
    payload: {
      title: "Sesi Chat Ditutup",
      message: "PH telah menutup sesi chat Anda",
      link: "/chat",
    },
    is_read: false,
    created_at: now,
  });

  return NextResponse.json({ ok: true, closed_at: now });
}
