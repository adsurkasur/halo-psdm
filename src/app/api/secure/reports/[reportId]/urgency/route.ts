import { NextResponse } from "next/server";
import { URGENCY_LABELS } from "@/data/domain";
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
  const body = (await request.json()) as { newUrgency: string };
  const now = new Date().toISOString();

  const { data: report } = await supabaseServer
    .from("reports")
    .select("id, case_id, user_id")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ error: "Report tidak ditemukan." }, { status: 404 });
  }

  await supabaseServer
    .from("reports")
    .update({ urgency: body.newUrgency })
    .eq("id", reportId);

  await supabaseServer.from("notifications").insert({
    id: crypto.randomUUID(),
    user_id: report.user_id,
    type: "STATUS_UPDATED",
    payload: {
      title: "Urgensi Diperbarui",
      message: `Urgensi laporan ${report.case_id} diubah menjadi ${URGENCY_LABELS[body.newUrgency as keyof typeof URGENCY_LABELS] ?? body.newUrgency}`,
      link: "/laporan",
    },
    is_read: false,
    created_at: now,
  });

  return NextResponse.json({ ok: true });
}
