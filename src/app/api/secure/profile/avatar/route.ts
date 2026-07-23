import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

const PROFILE_BUCKET = "profile-pictures";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireAuthUser(request);
  if ("error" in auth) return auth.error;

  const formData = await request.formData();
  const avatar = formData.get("avatar");

  if (!(avatar instanceof File)) {
    return NextResponse.json({ error: "File avatar tidak ditemukan." }, { status: 400 });
  }

  if (!avatar.type.startsWith("image/")) {
    return NextResponse.json({ error: "Avatar harus berupa file gambar." }, { status: 400 });
  }

  if (avatar.size > MAX_AVATAR_SIZE) {
    return NextResponse.json({ error: "Ukuran avatar maksimal 5MB." }, { status: 400 });
  }

  const ALLOWED_AVATAR_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  const ext = avatar.name.includes(".") ? avatar.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg" : "jpg";

  if (!ALLOWED_AVATAR_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: "Format avatar harus berupa gambar (jpg, png, webp, gif)." }, { status: 400 });
  }

  const avatarPath = `${auth.context.authUser.id}/avatar-${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const upload = await supabaseServer.storage
    .from(PROFILE_BUCKET)
    .upload(avatarPath, avatar, {
      upsert: true,
      contentType: avatar.type || undefined,
    });

  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 400 });
  }

  const { data: publicUrlData } = supabaseServer.storage.from(PROFILE_BUCKET).getPublicUrl(avatarPath);

  const update = await supabaseServer
    .from("users")
    .update({ avatar_url: publicUrlData.publicUrl })
    .eq("id", auth.context.authUser.id);

  if (update.error) {
    return NextResponse.json({ error: update.error.message }, { status: 400 });
  }

  return NextResponse.json({
    avatar_url: publicUrlData.publicUrl,
    avatar_path: avatarPath,
  });
}
