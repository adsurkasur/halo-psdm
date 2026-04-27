import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireAuthUser(request);
  if ("error" in auth) return auth.error;

  const authUser = auth.context.authUser;

  try {
    const payload = await request.json();
    
    // Validate payload keys
    const allowedKeys = ["name", "biro", "jabatan", "whatsapp", "avatar_url"];
    const updateData: Record<string, unknown> = {};
    
    for (const key of allowedKeys) {
      if (payload[key] !== undefined) {
        updateData[key] = payload[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Tidak ada data untuk diperbarui" }, { status: 400 });
    }

    let { error: updateError } = await supabaseServer
      .from("users")
      .update(updateData)
      .eq("id", authUser.id);

    // Fallback if whatsapp column is missing
    if (updateError && updateData.whatsapp !== undefined) {
      delete updateData.whatsapp;
      if (Object.keys(updateData).length > 0) {
        const retry = await supabaseServer
          .from("users")
          .update(updateData)
          .eq("id", authUser.id);
        updateError = retry.error;
      }
    }

    if (updateError) {
      console.error("[PROFILE_UPDATE_ERROR]", updateError);
      return NextResponse.json(
        { error: `Database error: ${updateError.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[PROFILE_UPDATE_EXCEPTION]", err);
    return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
  }
}
