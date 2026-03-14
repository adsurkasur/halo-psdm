import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

const ATTACHMENT_BUCKET = "report-attachments";
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireAuthContext(request);
  if ("error" in auth) return auth.error;

  const formData = await request.formData();
  const attachment = formData.get("attachment");

  if (!(attachment instanceof File)) {
    return NextResponse.json({ error: "File attachment tidak ditemukan." }, { status: 400 });
  }

  if (attachment.size > MAX_ATTACHMENT_SIZE) {
    return NextResponse.json({ error: "Ukuran attachment maksimal 10MB." }, { status: 400 });
  }

  const fileExt = attachment.name.includes(".") ? attachment.name.split(".").pop() : "bin";
  const objectPath = `${auth.context.authUser.id}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

  const upload = await supabaseServer.storage.from(ATTACHMENT_BUCKET).upload(objectPath, attachment, {
    upsert: false,
    contentType: attachment.type || undefined,
  });

  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 400 });
  }

  const { data: publicUrlData } = supabaseServer.storage.from(ATTACHMENT_BUCKET).getPublicUrl(objectPath);

  return NextResponse.json({
    attachment_url: publicUrlData.publicUrl,
    attachment_name: attachment.name,
    attachment_path: objectPath,
    attachment_mime: attachment.type || "application/octet-stream",
    attachment_size: attachment.size,
  });
}
