import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  // Only PH role can manually activate/verify users
  if (auth.context.appUser.role !== "PH") {
    return NextResponse.json({ error: "Hanya PH yang memiliki wewenang untuk verifikasi pengguna." }, { status: 403 });
  }

  const { targetUserId } = (await request.json()) as { targetUserId: string };
  if (!targetUserId) {
    return NextResponse.json({ error: "targetUserId wajib diisi." }, { status: 400 });
  }

  // 1. Update public.users profile to is_active = true
  const profileUpdate = await supabaseServer
    .from("users")
    .update({ is_active: true })
    .eq("id", targetUserId);

  if (profileUpdate.error) {
    return NextResponse.json({ error: profileUpdate.error.message }, { status: 400 });
  }

  // 2. Manually confirm user's email via Auth Admin API
  const authUpdate = await supabaseServer.auth.admin.updateUserById(targetUserId, {
    email_confirm: true,
  });

  if (authUpdate.error) {
    return NextResponse.json({ error: authUpdate.error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
