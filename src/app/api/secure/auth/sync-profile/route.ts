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

type SyncStage =
  | "auth"
  | "select-existing"
  | "update-existing"
  | "insert-new"
  | "resolve-legacy"
  | "readback";

function errorResponse(status: number, code: string, stage: SyncStage, message: string, context?: Record<string, unknown>) {
  console.error("[SYNC_PROFILE_ERROR]", { code, stage, message, ...context });
  return NextResponse.json({ error: message, diagnosticCode: code, stage }, { status });
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

  let existing: Record<string, unknown> | null = null;
  let existingError: { message: string } | null = null;

  // Try with whatsapp column first, fallback without it
  const selectResult = await supabaseServer
    .from("users")
    .select("id, name, email, biro, jabatan, role, avatar_url, whatsapp, is_active, created_at, updated_at")
    .eq("id", authUser.id)
    .maybeSingle();

  if (selectResult.error) {
    // Retry without whatsapp column (it may not exist yet)
    const fallbackResult = await supabaseServer
      .from("users")
      .select("id, name, email, biro, jabatan, role, avatar_url, is_active, created_at, updated_at")
      .eq("id", authUser.id)
      .maybeSingle();
    existing = fallbackResult.data;
    existingError = fallbackResult.error;
  } else {
    existing = selectResult.data;
    existingError = selectResult.error;
  }

  if (existingError) {
    return errorResponse(400, "SYNC_SELECT_EXISTING_FAILED", "select-existing", existingError.message, {
      authUserId: authUser.id,
      authEmail: authUser.email,
    });
  }

  let syncPath: "existing" | "insert-new" | "legacy-relink" = "existing";

  if (existing) {
    const updateData: Record<string, unknown> = {
      name: metadataName ?? existing.name,
      email: authUser.email ?? existing.email,
      biro: VALID_BIRO.includes(metadata.biro as BiroBidang) ? metadata.biro : existing.biro,
      jabatan: VALID_JABATAN.includes(metadata.jabatan as Jabatan) ? metadata.jabatan : existing.jabatan,
      avatar_url:
        typeof metadata.avatar_url === "string" && metadata.avatar_url.trim().length > 0
          ? metadata.avatar_url
          : existing.avatar_url,
      whatsapp:
        typeof metadata.whatsapp === "string" && metadata.whatsapp.trim().length > 0
          ? metadata.whatsapp
          : existing.whatsapp ?? null,
    };

    let { error: updateError } = await supabaseServer
      .from("users")
      .update(updateData)
      .eq("id", authUser.id);

    if (updateError) {
      // Retry without whatsapp field
      delete updateData.whatsapp;
      const retryResult = await supabaseServer
        .from("users")
        .update(updateData)
        .eq("id", authUser.id);
      updateError = retryResult.error;
    }

    if (updateError) {
      return errorResponse(400, "SYNC_UPDATE_EXISTING_FAILED", "update-existing", updateError.message, {
        authUserId: authUser.id,
        authEmail: authUser.email,
      });
    }

  } else {
    syncPath = "insert-new";
    const profilePayload = {
      id: authUser.id,
      name: metadataName ?? fallbackName,
      email: authUser.email ?? "",
      biro: pickBiro(metadata.biro),
      jabatan: pickJabatan(metadata.jabatan),
      avatar_url:
        typeof metadata.avatar_url === "string" && metadata.avatar_url.trim().length > 0
          ? metadata.avatar_url
          : null,
      whatsapp:
        typeof metadata.whatsapp === "string" && metadata.whatsapp.trim().length > 0
          ? metadata.whatsapp
          : null,
      role: "MEMBER",
    };

    const { error: insertError } = await supabaseServer
      .from("users")
      .insert(profilePayload);

    if (insertError) {
      // Legacy conflict case: same email exists with old/non-auth id.
      const { data: legacyByEmail, error: legacyReadError } = await supabaseServer
        .from("users")
        .select("id")
        .eq("email", profilePayload.email)
        .maybeSingle();

      if (legacyReadError || !legacyByEmail) {
        return errorResponse(
          400,
          "SYNC_INSERT_NEW_FAILED",
          "insert-new",
          insertError.message,
          {
            authUserId: authUser.id,
            authEmail: authUser.email,
          }
        );
      }

      syncPath = "legacy-relink";

      const { error: legacyUpdateError } = await supabaseServer
        .from("users")
        .update({
          id: authUser.id,
          name: profilePayload.name,
          biro: profilePayload.biro,
          jabatan: profilePayload.jabatan,
          is_active: true,
          email: profilePayload.email,
          avatar_url: profilePayload.avatar_url,
          whatsapp: profilePayload.whatsapp,
        })
        .eq("id", legacyByEmail.id);

      if (legacyUpdateError) {
        return errorResponse(
          409,
          "SYNC_LEGACY_RELINK_FAILED",
          "resolve-legacy",
          "Konflik data profil lama terdeteksi. Hubungi admin untuk menjalankan sinkronisasi manual akun/profil.",
          {
            authUserId: authUser.id,
            authEmail: authUser.email,
            legacyUserId: legacyByEmail.id,
          }
        );
      }
    }
  }

  let profile: Record<string, unknown> | null = null;
  let profileError: { message: string } | null = null;

  const readbackResult = await supabaseServer
    .from("users")
    .select("id, name, biro, jabatan, role, email, avatar_url, whatsapp, is_active, created_at, updated_at")
    .eq("id", authUser.id)
    .maybeSingle();

  if (readbackResult.error) {
    // Retry without whatsapp
    const fallbackReadback = await supabaseServer
      .from("users")
      .select("id, name, biro, jabatan, role, email, avatar_url, is_active, created_at, updated_at")
      .eq("id", authUser.id)
      .maybeSingle();
    profile = fallbackReadback.data;
    profileError = fallbackReadback.error;
  } else {
    profile = readbackResult.data;
    profileError = readbackResult.error;
  }

  if (profileError || !profile) {
    return errorResponse(
      404,
      "SYNC_READBACK_PROFILE_NOT_FOUND",
      "readback",
      profileError?.message ?? "Profil pengguna tidak ditemukan.",
      {
        authUserId: authUser.id,
        authEmail: authUser.email,
        syncPath,
      }
    );
  }

  return NextResponse.json({ profile, diagnosticCode: "SYNC_OK", stage: "readback", syncPath });
}
