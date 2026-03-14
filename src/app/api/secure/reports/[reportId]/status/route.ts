import { NextResponse } from "next/server";
import { STATUS_LABELS } from "@/data/domain";
import { forbidden, requireAuthContext } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  if (auth.context.appUser.role !== "PH") {
    return forbidden();
  }

  const { reportId } = await params;
  const body = (await request.json()) as { newStatus: string; note?: string };

  const { data: report } = await supabaseServer
    .from("reports")
    .select("id, case_id, user_id, status")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ error: "Report tidak ditemukan." }, { status: 404 });
  }

  const now = new Date().toISOString();

  await supabaseServer
    .from("reports")
    .update({ status: body.newStatus, updated_at: now })
    .eq("id", reportId);

  const historyEntry = {
    id: `sh_${crypto.randomUUID()}`,
    report_id: reportId,
    old_status: report.status,
    new_status: body.newStatus,
    changed_by: auth.context.appUser.id,
    note: body.note || `Status diubah ke ${STATUS_LABELS[body.newStatus as keyof typeof STATUS_LABELS] ?? body.newStatus}`,
    created_at: now,
  };

  await supabaseServer.from("report_status_history").insert(historyEntry);

  await supabaseServer.from("notifications").insert({
    id: `n_${crypto.randomUUID()}`,
    user_id: report.user_id,
    type: body.newStatus === "DONE" ? "REPORT_DONE" : "STATUS_UPDATED",
    payload: {
      title: body.newStatus === "DONE" ? "Kasus Selesai" : "Status Diperbarui",
      message: `Laporan ${report.case_id} telah diperbarui ke ${STATUS_LABELS[body.newStatus as keyof typeof STATUS_LABELS] ?? body.newStatus}`,
      link: "/laporan",
    },
    is_read: false,
    created_at: now,
  });

  return NextResponse.json({ ok: true, historyEntry });
}
