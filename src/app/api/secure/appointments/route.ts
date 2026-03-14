import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as { targetAdminId: string };
  const now = new Date().toISOString();

  const appointment = {
    id: `apt_${crypto.randomUUID()}`,
    user_id: auth.context.appUser.id,
    target_admin_id: body.targetAdminId,
    created_at: now,
  };

  const inserted = await supabaseServer.from("appointments").insert(appointment);
  if (inserted.error) {
    return NextResponse.json({ error: inserted.error.message }, { status: 400 });
  }

  await supabaseServer.from("notifications").insert({
    id: `n_${crypto.randomUUID()}`,
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
