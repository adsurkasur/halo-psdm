import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/supabase/secure-route";
import type { BiroBidang, Jabatan } from "@/data/domain";

const VALID_BIRO: BiroBidang[] = ["KETUM", "ADKEU", "PSDM", "PENKOM", "RISTEK", "INFOKOM"];
const VALID_JABATAN: Jabatan[] = ["PENGURUS_HARIAN", "STAF_AHLI", "STAF", "ANGGOTA_MUDA"];

function pickBiro(input: unknown): BiroBidang {
  return VALID_BIRO.includes(input as BiroBidang) ? (input as BiroBidang) : "INFOKOM";
}

function pickJabatan(input: unknown): Jabatan {
  return VALID_JABATAN.includes(input as Jabatan) ? (input as Jabatan) : "ANGGOTA_MUDA";
}

export async function POST(request: Request) {
  const auth = await requireAuthUser(request);
  if ("error" in auth) return auth.error;

  const authUser = auth.context.authUser;
  const metadata = authUser.user_metadata ?? {};
  const metadataName =
    typeof metadata.name === "string" && metadata.name.trim().length > 0
      ? metadata.name.trim()
      : null;
  const fallbackName = authUser.email?.split("@")[0] ?? "User";

  const { data: existing, error: existingError } = await supabaseServer
    .from("users")
    .select("id, name, email, biro, jabatan")
    .eq("id", authUser.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 });
  }

  if (existing) {
    const { error: updateError } = await supabaseServer
      .from("users")
      .update({
        name: metadataName ?? existing.name,
        email: authUser.email ?? existing.email,
        biro: VALID_BIRO.includes(metadata.biro as BiroBidang) ? metadata.biro : existing.biro,
        jabatan: VALID_JABATAN.includes(metadata.jabatan as Jabatan) ? metadata.jabatan : existing.jabatan,
      })
      .eq("id", authUser.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
  } else {
    const { error: insertError } = await supabaseServer.from("users").insert({
      id: authUser.id,
      name: metadataName ?? fallbackName,
      email: authUser.email ?? "",
      biro: pickBiro(metadata.biro),
      jabatan: pickJabatan(metadata.jabatan),
      role: "SENDER",
      is_active: true,
      created_at: authUser.created_at ? new Date(authUser.created_at).toISOString() : new Date().toISOString(),
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from("users")
    .select("id, name, biro, jabatan, role, email, is_active, created_at")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: profileError?.message ?? "Profil pengguna tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ profile });
}
