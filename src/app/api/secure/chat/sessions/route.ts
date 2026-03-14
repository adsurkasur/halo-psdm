import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as { reportId?: string | null };
  const now = new Date().toISOString();
  const session = {
    id: `cs_${crypto.randomUUID()}`,
    report_id: body.reportId ?? null,
    user_id: auth.context.appUser.id,
    assigned_admin_id: null,
    status: "OPEN",
    created_at: now,
    closed_at: null,
  };

  const inserted = await supabaseServer.from("chat_sessions").insert(session);
  if (inserted.error) {
    return NextResponse.json({ error: inserted.error.message }, { status: 400 });
  }

  const { data: admins } = await supabaseServer
    .from("users")
    .select("id")
    .in("role", ["PH"]);

  if (admins && admins.length > 0) {
    const notifications = admins.map((admin) => ({
      id: `n_${crypto.randomUUID()}`,
      user_id: admin.id,
      type: "NEW_CHAT_SESSION",
      payload: {
        title: "Sesi Chat Baru",
        message: `Sesi chat baru dari ${auth.context.appUser.name}`,
        link: "/admin/chat",
      },
      is_read: false,
      created_at: now,
    }));

    await supabaseServer.from("notifications").insert(notifications);
  }

  return NextResponse.json({ session });
}
