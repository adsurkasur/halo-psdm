import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

const CHAT_MEDIA_BUCKET = "chat-media";
const MAX_MEDIA_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  const formData = await request.formData();
  const sessionId = formData.get("sessionId");
  const media = formData.get("media");

  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    return NextResponse.json({ error: "Session chat tidak valid." }, { status: 400 });
  }

  if (!(media instanceof File)) {
    return NextResponse.json({ error: "File media tidak ditemukan." }, { status: 400 });
  }

  if (media.size > MAX_MEDIA_SIZE) {
    return NextResponse.json({ error: "Ukuran file maksimal 10MB." }, { status: 400 });
  }

  const { data: session } = await supabaseServer
    .from("chat_sessions")
    .select("id, user_id, assigned_admin_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "Session tidak ditemukan." }, { status: 404 });
  }

  const isSender = auth.context.appUser.id === session.user_id;
  const isAssignedAdmin = session.assigned_admin_id === auth.context.appUser.id;
  const isAdminRole = ["ADMIN", "SUPER_ADMIN"].includes(auth.context.appUser.role);

  if (!isSender && !isAssignedAdmin && !isAdminRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ext = media.name.includes(".") ? media.name.split(".").pop() : "bin";
  const mediaPath = `${auth.context.authUser.id}/${sessionId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const upload = await supabaseServer.storage.from(CHAT_MEDIA_BUCKET).upload(mediaPath, media, {
    upsert: false,
    contentType: media.type || undefined,
  });

  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 400 });
  }

  const { data: publicUrlData } = supabaseServer.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(mediaPath);

  return NextResponse.json({
    media_url: publicUrlData.publicUrl,
    media_path: mediaPath,
    media_name: media.name,
    media_mime: media.type || "application/octet-stream",
    media_size: media.size,
  });
}
