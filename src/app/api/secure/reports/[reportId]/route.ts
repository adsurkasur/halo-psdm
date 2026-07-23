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

  // Delete attachment file from Supabase Storage if present
  if (report.attachment_path) {
    await supabaseServer.storage.from("report-attachments").remove([report.attachment_path]);
  }

  // Delete report (Postgres CASCADE deletes report_status_history and chat_sessions)
  const { error: deleteError } = await supabaseServer
    .from("reports")
    .delete()
    .eq("id", reportId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
