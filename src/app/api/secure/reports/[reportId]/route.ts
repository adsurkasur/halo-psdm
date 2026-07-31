import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  const { reportId } = await params;

  const { data: report, error: fetchError } = await supabaseServer
    .from("reports")
    .select("id, user_id, attachment_path")
    .eq("id", reportId)
    .maybeSingle();

  if (fetchError || !report) {
    return NextResponse.json({ error: "Laporan tidak ditemukan." }, { status: 404 });
  }

  const isOwner = auth.context.appUser.id === report.user_id;
  const isElevated = auth.context.appUser.role === "PH" || auth.context.appUser.role === "HR";

  if (!isOwner && !isElevated) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: linkedChats, error: linkedChatsError } = await supabaseServer
    .from("chat_sessions")
    .select("id, status")
    .eq("report_id", reportId);

  if (linkedChatsError) {
    return NextResponse.json(
      { error: `Riwayat chat gagal diperiksa: ${linkedChatsError.message}` },
      { status: 409 },
    );
  }

  // Chat history has independent retention and must survive report deletion,
  // including during a rolling deploy before the SET NULL migration is active.
  const detachedChats = await supabaseServer
    .from("chat_sessions")
    .update({ report_id: null })
    .eq("report_id", reportId);

  if (detachedChats.error) {
    return NextResponse.json(
      { error: `Riwayat chat gagal diamankan: ${detachedChats.error.message}` },
      { status: 409 },
    );
  }

  if (linkedChats && linkedChats.length > 0) {
    const auditResult = await supabaseServer.from("chat_session_events").insert(
      linkedChats.map((session) => ({
        id: crypto.randomUUID(),
        session_id: session.id,
        actor_user_id: auth.context.appUser.id,
        actor_name_snapshot: auth.context.appUser.name,
        event_type: "REPORT_DETACHED",
        old_status: session.status,
        new_status: session.status,
        metadata: { deleted_report_id: reportId },
        created_at: new Date().toISOString(),
      })),
    );

    if (auditResult.error) {
      await supabaseServer
        .from("chat_sessions")
        .update({ report_id: reportId })
        .in("id", linkedChats.map((session) => session.id));

      return NextResponse.json(
        { error: `Pelepasan laporan gagal diaudit: ${auditResult.error.message}` },
        { status: 409 },
      );
    }
  }

  // Delete attachment file from Supabase Storage if present
  if (report.attachment_path) {
    await supabaseServer.storage.from("report-attachments").remove([report.attachment_path]);
  }

  // Delete the report only after linked chat sessions have been retained.
  const { error: deleteError } = await supabaseServer
    .from("reports")
    .delete()
    .eq("id", reportId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
