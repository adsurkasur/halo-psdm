import { createClient, type User as SupabaseAuthUser } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { UserRole } from "@/data/domain";

type AppUser = {
  id: string;
  name: string;
  role: UserRole;
  email: string;
};

type AuthContext = {
  authUser: SupabaseAuthUser;
  appUser: AppUser;
};

type AuthUserContext = {
  authUser: SupabaseAuthUser;
};

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length);
}

export async function requireAuthContext(request: Request): Promise<{ error: NextResponse } | { context: AuthContext }> {
  const authUserResult = await requireAuthUser(request);
  if ("error" in authUserResult) {
    return authUserResult;
  }

  const { authUser } = authUserResult.context;

  const { data: appUser, error: appUserError } = await supabaseServer
    .from("users")
    .select("id, name, role, email")
    .eq("id", authUser.id)
    .maybeSingle();

  if (appUserError || !appUser) {
    return {
      error: NextResponse.json({ error: "Profil pengguna tidak ditemukan." }, { status: 403 }),
    };
  }

  return {
    context: {
      authUser,
      appUser: appUser as AppUser,
    },
  };
}

export async function requireAuthUser(request: Request): Promise<{ error: NextResponse } | { context: AuthUserContext }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return {
      error: NextResponse.json({ error: "Supabase env belum lengkap di server." }, { status: 500 }),
    };
  }

  const token = getBearerToken(request);
  if (!token) {
    return {
      error: NextResponse.json({ error: "Sesi login tidak valid atau kadaluarsa (token tidak ditemukan)." }, { status: 401 }),
    };
  }

  const authClient = createClient(supabaseUrl, supabasePublishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: userRes, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userRes.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  return {
    context: {
      authUser: userRes.user,
    },
  };
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}
