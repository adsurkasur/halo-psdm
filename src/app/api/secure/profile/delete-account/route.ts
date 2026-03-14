import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

type DeleteAccountBody = {
  confirmationPhrase?: string;
  email?: string;
};

const CONFIRMATION_PHRASE = "delete account";

async function cleanupUserStorage(bucket: string, userId: string) {
  const prefix = `${userId}/`;
  let offset = 0;

  while (true) {
    const listResult = await supabaseServer.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (listResult.error) {
      return;
    }

    const items = listResult.data ?? [];
    if (items.length === 0) {
      return;
    }

    const paths = items
      .filter((item) => Boolean(item.name) && Boolean(item.id))
      .map((item) => `${prefix}${item.name}`);

    if (paths.length > 0) {
      await supabaseServer.storage.from(bucket).remove(paths);
    }

    if (items.length < 100) {
      return;
    }

    offset += 100;
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthUser(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as DeleteAccountBody;
  const confirmationPhrase = (body.confirmationPhrase ?? "").trim().toLowerCase();
  const requestedEmail = (body.email ?? "").trim().toLowerCase();
  const currentEmail = (auth.context.authUser.email ?? "").trim().toLowerCase();

  if (confirmationPhrase !== CONFIRMATION_PHRASE) {
    return NextResponse.json({ error: "Konfirmasi tidak valid. Ketik tepat: delete account" }, { status: 400 });
  }

  if (!currentEmail || requestedEmail !== currentEmail) {
    return NextResponse.json({ error: "Email konfirmasi tidak sesuai dengan akun aktif." }, { status: 400 });
  }

  await cleanupUserStorage("profile-pictures", auth.context.authUser.id);
  await cleanupUserStorage("report-attachments", auth.context.authUser.id);
  await cleanupUserStorage("chat-media", auth.context.authUser.id);

  await supabaseServer.from("admin_profiles").delete().or(`id.eq.${auth.context.authUser.id},user_id.eq.${auth.context.authUser.id}`);
  await supabaseServer.from("users").delete().eq("id", auth.context.authUser.id);

  const deleteAuthUser = await supabaseServer.auth.admin.deleteUser(auth.context.authUser.id);
  if (deleteAuthUser.error) {
    return NextResponse.json({ error: deleteAuthUser.error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
