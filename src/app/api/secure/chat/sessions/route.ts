import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as { reportId?: string | null; userId?: string | null };

  let targetUserId = auth.context.appUser.id;
  const requestedUserId = typeof body.userId === "string" ? body.userId.trim() : "";
  const isElevated = auth.context.appUser.role === "PH" || auth.context.appUser.role === "HR";

  if (requestedUserId && requestedUserId !== auth.context.appUser.id) {
    if (!isElevated) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    targetUserId = requestedUserId;
  }

  if (body.reportId) {
    const { data: report, error: reportError } = await supabaseServer
      .from("reports")
      .select("id, user_id")
      .eq("id", body.reportId)
      .maybeSingle();

    if (reportError || !report) {
      return NextResponse.json({ error: "Laporan tidak ditemukan." }, { status: 404 });
    }

    // Clarification chat should always target report owner for elevated users.
    if (isElevated) {
      targetUserId = report.user_id;
    }
  }

  const { data: targetUser, error: targetUserError } = await supabaseServer
    .from("users")
    .select("id")
    .eq("id", targetUserId)
    .maybeSingle();

  if (targetUserError || !targetUser) {
    return NextResponse.json({ error: "Target pengguna tidak ditemukan." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const session = {
    id: `cs_${crypto.randomUUID()}`,
    report_id: body.reportId ?? null,
    user_id: targetUserId,
    assigned_admin_id: null,
    status: "OPEN",
    created_at: now,
    closed_at: null,
  };

  const inserted = await supabaseServer.from("chat_sessions").insert(session);
  if (inserted.error) {
    return NextResponse.json({ error: inserted.error.message }, { status: 400 });
  }

  if (auth.context.appUser.id === targetUserId) {
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
  } else {
    await supabaseServer.from("notifications").insert({
      id: `n_${crypto.randomUUID()}`,
      user_id: targetUserId,
      type: "NEW_CHAT_SESSION",
      payload: {
        title: "Chat dari PSDM",
        message: `PH membuka sesi chat untuk laporan Anda.`,
        link: `/chat/${session.id}`,
      },
      is_read: false,
      created_at: now,
    });
  }

  return NextResponse.json({ session });
}
