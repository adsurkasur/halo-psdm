import { NextResponse } from "next/server";
import { generateCaseId } from "@/data/domain";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/supabase/secure-route";

export async function POST(request: Request) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    category: string;
    urgency: string;
    kronologi: string;
    attachment_url?: string | null;
    attachment_name?: string | null;
    attachment_path?: string | null;
    attachment_mime?: string | null;
    attachment_size?: number | null;
  };

  const now = new Date().toISOString();
  const reportId = crypto.randomUUID();

  const report = {
    id: reportId,
    case_id: generateCaseId(),
    user_id: auth.context.appUser.id,
    category: body.category,
    urgency: body.urgency,
    kronologi: body.kronologi,
    attachment_url: body.attachment_url ?? null,
    attachment_name: body.attachment_name ?? null,
    attachment_path: body.attachment_path ?? null,
    attachment_mime: body.attachment_mime ?? null,
    attachment_size: body.attachment_size ?? null,
    status: "RECEIVED",
    admin_notes: "",
    created_at: now,
  };

  const insertReport = await supabaseServer.from("reports").insert(report);
  if (insertReport.error) {
    return NextResponse.json({ error: insertReport.error.message }, { status: 400 });
  }

  const historyEntry = {
    id: crypto.randomUUID(),
    report_id: reportId,
    old_status: null,
    new_status: "RECEIVED",
    changed_by: "system",
    note: "Laporan diterima",
    created_at: now,
  };

  await supabaseServer.from("report_status_history").insert(historyEntry);

  const { data: admins } = await supabaseServer
    .from("users")
    .select("id")
    .in("role", ["PH"]);

  if (admins && admins.length > 0) {
    const notifications = admins.map((admin) => ({
      id: crypto.randomUUID(),
      user_id: admin.id,
      type: "NEW_REPORT",
      payload: {
        title: "Laporan Baru",
        message: `Laporan baru dari ${auth.context.appUser.name} — Kategori: ${body.category} (${body.urgency})`,
        link: `/admin/laporan/${report.id}`,
      },
      is_read: false,
      created_at: now,
    }));
    await supabaseServer.from("notifications").insert(notifications);
  }

  return NextResponse.json({ report, historyEntry });
}
