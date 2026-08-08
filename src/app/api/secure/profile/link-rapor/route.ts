import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase/secure-route";
import { supabaseServer } from "@/lib/supabase/server";

type LinkRequest = {
  accessCode?: unknown;
};

export async function POST(request: Request) {
  const auth = await requireAuthUser(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as LinkRequest;
  const accessCode = typeof body.accessCode === "string" ? body.accessCode.trim() : "";

  if (!accessCode || accessCode.length > 200) {
    return NextResponse.json({ error: "Masukkan kode akses Rapor yang valid." }, { status: 400 });
  }

  const pepper = process.env.RAPOR_ACCESS_CODE_PEPPER?.trim();
  if (!pepper) {
    return NextResponse.json({ error: "Integrasi identitas Rapor belum dikonfigurasi." }, { status: 503 });
  }

  const accessCodeHash = crypto
    .createHash("sha256")
    .update(`${accessCode.toLowerCase()}::${pepper}`, "utf8")
    .digest("hex");

  const { data: codeRow, error: codeError } = await supabaseServer
    .from("rapor_access_codes")
    .select("member_code, release_code")
    .eq("access_code_hash", accessCodeHash)
    .maybeSingle();

  if (codeError || !codeRow) {
    return NextResponse.json({ error: "Kode akses tidak cocok dengan Rapor aktif." }, { status: 400 });
  }

  const { data: memberRow, error: memberError } = await supabaseServer
    .from("rapor_members")
    .select("member_code, release_code, name, unit, jabatan, rapor_releases!inner(status, is_active)")
    .eq("member_code", codeRow.member_code)
    .eq("release_code", codeRow.release_code)
    .eq("rapor_releases.status", "published")
    .eq("rapor_releases.is_active", true)
    .maybeSingle();

  if (memberError || !memberRow) {
    return NextResponse.json({ error: "Rapor untuk kode ini belum aktif atau belum dipublikasikan." }, { status: 400 });
  }

  const { data: linked, error: linkError } = await supabaseServer.rpc("link_arsc_account_from_reference", {
    p_user_id: auth.context.authUser.id,
    p_release_member_code: memberRow.member_code,
    p_release_code: memberRow.release_code,
    p_canonical_name: memberRow.name,
    p_unit: memberRow.unit,
    p_position: memberRow.jabatan,
  });

  if (linkError || !linked) {
    return NextResponse.json(
      { error: linkError?.message ?? "Identitas ARSC belum dapat ditautkan." },
      { status: 400 },
    );
  }

  return NextResponse.json({ identity: linked });
}
