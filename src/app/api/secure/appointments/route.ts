import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

type AppointmentPatchBody = {
  appointmentId: string;
  status: "OPEN" | "DONE" | "DISMISSED";
  statusNote?: string;
};

export async function POST(request: Request) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as { targetAdminId: string };
  const now = new Date().toISOString();

  const appointment = {
    id: crypto.randomUUID(),
    user_id: auth.context.appUser.id,
    target_admin_id: body.targetAdminId,
    status: "OPEN",
    status_note: null,
    handled_by: null,
    handled_at: null,
    created_at: now,
  };

  const inserted = await supabaseServer.from("appointments").insert(appointment);
  if (inserted.error) {
    return NextResponse.json({ error: inserted.error.message }, { status: 400 });
  }

  await supabaseServer.from("notifications").insert({
    id: crypto.randomUUID(),
    user_id: body.targetAdminId,
    type: "APPOINTMENT_REQUEST",
    payload: {
      title: "Permintaan Janji Temu",
      message: `Permintaan janji temu baru dari ${auth.context.appUser.name}`,
    },
    is_read: false,
    created_at: now,
  });

  return NextResponse.json({ appointment });
}

export async function PATCH(request: Request) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  if (auth.context.appUser.role !== "PH") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as AppointmentPatchBody;
  if (!body.appointmentId || !body.status) {
    return NextResponse.json({ error: "appointmentId dan status wajib diisi." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updatePayload = {
    status: body.status,
    status_note: body.statusNote?.trim() ? body.statusNote.trim() : null,
    handled_by: auth.context.appUser.id,
    handled_at: now,
  };

  const { data, error } = await supabaseServer
    .from("appointments")
    .update(updatePayload)
    .eq("id", body.appointmentId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Janji temu tidak ditemukan." }, { status: 400 });
  }

  return NextResponse.json({ appointment: data });
}
