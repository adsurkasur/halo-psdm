import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import {
  type User,
  type UserRole,
  type BiroBidang,
  type Jabatan,
  type ThemePreference,
  JABATAN_LABELS,
} from "@/data/domain";
import { supabase } from "@/lib/supabase/client";

type UsersRow = {
  id: string;
  name: string;
  biro: BiroBidang;
  jabatan: Jabatan;
  role: UserRole;
  email: string;
  avatar_url?: string | null;
  theme_preference?: ThemePreference | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function mapRowToUser(row: UsersRow): User {
  return {
    id: row.id,
    name: row.name,
    biro: row.biro,
    jabatan: row.jabatan,
    role: row.role,
    email: row.email,
    avatar_url: row.avatar_url,
    theme_preference: row.theme_preference,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSender: boolean;
  isHr: boolean;
  isPh: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    biro: BiroBidang;
    jabatan: Jabatan;
  }) => Promise<{ success: boolean; error?: string; message?: string }>;
  logout: () => void;
  allUsers: User[];
  refreshUsers: (force?: boolean) => Promise<void>;
  syncProfileNow: () => Promise<{ success: boolean; error?: string; profile?: User }>;
  updateProfile: (updates: Partial<Pick<User, "name" | "password" | "email" | "biro" | "jabatan" | "avatar_url" | "theme_preference">>) => Promise<{ success: boolean; error?: string; message?: string }>;
  changeUserRole: (userId: string, newRole: UserRole) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const VALID_BIRO: BiroBidang[] = ["KETUM", "ADKEU", "PSDM", "PENKOM", "RISTEK", "INFOKOM"];
const VALID_JABATAN: Jabatan[] = ["PENGURUS_HARIAN", "STAF_AHLI", "STAF", "ANGGOTA_MUDA"];

function normalizeBiro(input: unknown): BiroBidang {
  return VALID_BIRO.includes(input as BiroBidang) ? (input as BiroBidang) : "INFOKOM";
}

function normalizeJabatan(input: unknown): Jabatan {
  return VALID_JABATAN.includes(input as Jabatan) ? (input as Jabatan) : "ANGGOTA_MUDA";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type SyncProfileResult = {
  success: boolean;
  error?: string;
  profile?: UsersRow;
  diagnosticCode?: string;
  stage?: string;
};

type SyncProfileResponsePayload = {
  error?: string;
  profile?: UsersRow;
  diagnosticCode?: string;
  stage?: string;
};

function appendDiagnostic(error: string, code?: string, stage?: string) {
  if (!code && !stage) return error;
  if (code && stage) return `${error} [${code} @ ${stage}]`;
  if (code) return `${error} [${code}]`;
  return `${error} [${stage}]`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const USERS_CACHE_TTL_MS = 15000;
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const refreshUsersInFlightRef = useRef<Promise<void> | null>(null);
  const usersCacheRef = useRef<{ at: number; users: User[] } | null>(null);

  const ensureAppProfileForAuthUser = useCallback(async (authUser: SupabaseAuthUser) => {
    const metadata = authUser.user_metadata ?? {};
    const defaultName = authUser.email?.split("@")[0] ?? "User";
    const createdAt = authUser.created_at ? new Date(authUser.created_at).toISOString() : new Date().toISOString();

    const metadataName =
      typeof metadata.name === "string" && metadata.name.trim().length > 0
        ? metadata.name.trim()
        : null;
    const metadataBiro = VALID_BIRO.includes(metadata.biro as BiroBidang)
      ? (metadata.biro as BiroBidang)
      : null;
    const metadataJabatan = VALID_JABATAN.includes(metadata.jabatan as Jabatan)
      ? (metadata.jabatan as Jabatan)
      : null;

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("users")
      .select("id, name, email, biro, jabatan, avatar_url, is_active, created_at, updated_at")
      .eq("id", authUser.id)
      .maybeSingle();

    if (existingProfileError) {
      return { success: false, error: existingProfileError.message };
    }

    if (existingProfile) {
      const profilePatch = {
        name: metadataName ?? (existingProfile as UsersRow).name,
        email: authUser.email ?? (existingProfile as UsersRow).email,
        biro: metadataBiro ?? (existingProfile as UsersRow).biro,
        jabatan: metadataJabatan ?? (existingProfile as UsersRow).jabatan,
      };

      const { error } = await supabase
        .from("users")
        .update(profilePatch)
        .eq("id", authUser.id);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    }

    const { error } = await supabase.from("users").insert({
      id: authUser.id,
      name: metadataName ?? defaultName,
      email: authUser.email ?? "",
      biro: metadataBiro ?? "INFOKOM",
      jabatan: metadataJabatan ?? "ANGGOTA_MUDA",
      role: "MEMBER",
      is_active: true,
      created_at: createdAt,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }, []);

  const loadAppUserById = useCallback(async (userId: string) => {
    const readProfile = async () =>
      supabase
      .from("users")
      .select("id, name, biro, jabatan, role, email, avatar_url, is_active, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    let { data, error } = await readProfile();

    if (!data) {
      const { data: authUserData } = await supabase.auth.getUser();
      if (authUserData.user && authUserData.user.id === userId) {
        await ensureAppProfileForAuthUser(authUserData.user);
        const secondRead = await readProfile();
        data = secondRead.data;
        error = secondRead.error;
      }
    }

    if (error || !data || !data.is_active) {
      setUser(null);
      return;
    }

    setUser(mapRowToUser(data as UsersRow));
  }, [ensureAppProfileForAuthUser]);

  const refreshUsers = useCallback(async (force = false) => {
    const now = Date.now();
    const cached = usersCacheRef.current;
    if (!force && cached && now - cached.at < USERS_CACHE_TTL_MS) {
      setUsers(cached.users);
      return;
    }

    if (refreshUsersInFlightRef.current) {
      await refreshUsersInFlightRef.current;
      return;
    }

    const refreshPromise = (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, biro, jabatan, role, email, avatar_url, is_active, created_at, updated_at")
        .order("created_at", { ascending: true });

      if (error) {
        return;
      }

      const mapped = (data ?? []).map((row) => mapRowToUser(row as UsersRow));
      usersCacheRef.current = { at: Date.now(), users: mapped };
      setUsers(mapped);
    })();

    refreshUsersInFlightRef.current = refreshPromise;
    try {
      await refreshPromise;
    } finally {
      refreshUsersInFlightRef.current = null;
    }
  }, []);

  const syncProfileThroughServer = useCallback(async (): Promise<SyncProfileResult> => {
    let accessToken: string | undefined;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { data: sessionData } = await supabase.auth.getSession();
      accessToken = sessionData.session?.access_token;
      if (accessToken) break;
      if (attempt < 3) await sleep(250);
    }

    if (!accessToken) {
      return {
        success: false,
        error: appendDiagnostic("Sesi login belum siap. Silakan login ulang.", "CLIENT_NO_ACCESS_TOKEN", "auth"),
        diagnosticCode: "CLIENT_NO_ACCESS_TOKEN",
        stage: "auth",
      };
    }

    try {
      const response = await fetch("/api/secure/auth/sync-profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = (await response.json().catch(() => null)) as SyncProfileResponsePayload | null;

      if (!response.ok) {
        const errorMessage = appendDiagnostic(
          payload?.error ??
            "Sinkronisasi profil via server gagal. Coba lagi sebentar, atau hubungi admin untuk sinkronisasi manual.",
          payload?.diagnosticCode,
          payload?.stage
        );

        console.warn("[SYNC_PROFILE_CLIENT_WARN]", {
          diagnosticCode: payload?.diagnosticCode,
          stage: payload?.stage,
          status: response.status,
          error: payload?.error,
        });

        return {
          success: false,
          error: errorMessage,
          diagnosticCode: payload?.diagnosticCode,
          stage: payload?.stage,
        };
      }

      if (!payload?.profile) {
        return {
          success: false,
          error: appendDiagnostic(
            "Sinkronisasi profil berhasil dipanggil, tetapi data profil belum tersedia.",
            "CLIENT_PROFILE_PAYLOAD_MISSING",
            payload?.stage
          ),
          diagnosticCode: "CLIENT_PROFILE_PAYLOAD_MISSING",
          stage: payload?.stage,
        };
      }

      return {
        success: true,
        profile: payload.profile,
        diagnosticCode: payload?.diagnosticCode,
        stage: payload?.stage,
      };
    } catch {
      return {
        success: false,
        error: appendDiagnostic("Sinkronisasi profil via server sedang tidak tersedia.", "CLIENT_FETCH_FAILED", "network"),
        diagnosticCode: "CLIENT_FETCH_FAILED",
        stage: "network",
      };
    }
  }, []);

  const syncProfileNow = useCallback(async (): Promise<SyncProfileResult> => {
    const { data: authUserData, error: authUserError } = await supabase.auth.getUser();

    if (authUserError || !authUserData.user) {
      return { success: false, error: "Sesi login tidak ditemukan. Silakan login kembali." };
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const serverSync = await syncProfileThroughServer();
      if (serverSync.success && serverSync.profile) {
        if (!serverSync.profile.is_active) {
          return { success: false, error: "Akun tidak aktif. Hubungi admin untuk aktivasi akun." };
        }

        setUser(mapRowToUser(serverSync.profile));
        return { success: true, profile: serverSync.profile };
      }

      const ensured = await ensureAppProfileForAuthUser(authUserData.user);
      if (ensured.success) {
        const { data, error } = await supabase
          .from("users")
          .select("id, name, biro, jabatan, role, email, avatar_url, is_active, created_at, updated_at")
          .eq("id", authUserData.user.id)
          .maybeSingle();

        if (!error && data) {
          const profile = data as UsersRow;
          if (!profile.is_active) {
            return { success: false, error: "Akun tidak aktif. Hubungi admin untuk aktivasi akun." };
          }

          setUser(mapRowToUser(profile));
          return { success: true, profile };
        }
      }

      if (attempt < 2) {
        await sleep(500);
      }
    }

    return {
      success: false,
      error: appendDiagnostic(
        "Profil belum bisa disinkronkan saat ini. Coba lagi beberapa saat, atau hubungi admin jika masalah berlanjut.",
        "CLIENT_SYNC_ALL_PATHS_FAILED",
        "final"
      ),
      diagnosticCode: "CLIENT_SYNC_ALL_PATHS_FAILED",
      stage: "final",
    };
  }, [ensureAppProfileForAuthUser, syncProfileThroughServer]);

  useEffect(() => {
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();

      const sessionUserId = data.session?.user?.id;
      if (sessionUserId) {
        const synced = await syncProfileNow();
        if (!synced.success) {
          setUser(null);
          setUsers([]);
          usersCacheRef.current = null;
        } else {
          await refreshUsers();
        }
      } else {
        setUsers([]);
        usersCacheRef.current = null;
      }

      setIsLoading(false);
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUserId = session?.user?.id;
      if (!sessionUserId) {
        setUser(null);
        setUsers([]);
        usersCacheRef.current = null;
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void (async () => {
          const synced = await syncProfileNow();
          if (synced.success) {
            await refreshUsers();
          }
        })();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshUsers, syncProfileNow]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        return { success: false, error: "Email atau password salah." };
      }

      const synced = await syncProfileNow();
      if (!synced.success) {
        return {
          success: false,
          error: synced.error,
        };
      }

      if (!synced.profile) {
        const { data: fallbackProfile } = await supabase
          .from("users")
          .select("id, name, biro, jabatan, role, email, avatar_url, is_active, created_at, updated_at")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (!fallbackProfile) {
          return {
            success: false,
            error:
              "Profil akun belum siap sepenuhnya. Coba login ulang 10-20 detik lagi atau klik Sinkronkan Profil Sekarang.",
          };
        }

        synced.profile = fallbackProfile as UsersRow;
      }

      const found = mapRowToUser(synced.profile);
      if (!synced.profile.is_active) {
        await supabase.auth.signOut();
        return { success: false, error: "Email atau password salah." };
      }

      setUser(found);
      await refreshUsers();

      return { success: true };
    },
    [refreshUsers, syncProfileNow]
  );

  const register = useCallback(
    async (data: { name: string; email: string; password: string; biro: BiroBidang; jabatan: Jabatan }) => {
      const exists = users.find((u) => u.email === data.email);
      if (exists) {
        return { success: false, error: "Email sudah terdaftar." };
      }
      if (data.password.length < 6) {
        return { success: false, error: "Password minimal 6 karakter." };
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            biro: data.biro,
            jabatan: data.jabatan,
          },
        },
      });

      if (authError || !authData.user) {
        return { success: false, error: authError?.message ?? "Registrasi gagal. Silakan coba lagi." };
      }

      if (!authData.session) {
        return {
          success: true,
          message: "Registrasi berhasil. Silakan cek email untuk konfirmasi akun, lalu login kembali.",
        };
      }

      const synced = await syncProfileNow();
      if (!synced.success) {
        return { success: false, error: synced.error ?? "Akun auth dibuat, tetapi profil pengguna gagal disimpan." };
      }

      await loadAppUserById(authData.user.id);
      await refreshUsers();

      return { success: true };
    },
    [users, refreshUsers, loadAppUserById, syncProfileNow]
  );

  const logout = useCallback(() => {
    void supabase.auth.signOut();
    setUser(null);
    setUsers([]);
    usersCacheRef.current = null;
  }, []);

  const changeUserRole = useCallback(
    async (userId: string, newRole: UserRole) => {
      const { error } = await supabase
        .from("users")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) {
        return { success: false, error: "Gagal mengubah role pengguna." };
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      if (user && user.id === userId) {
        setUser({ ...user, role: newRole });
      }

      return { success: true };
    },
    [user]
  );

  const updateProfile = useCallback(
    async (updates: Partial<Pick<User, "name" | "password" | "email" | "biro" | "jabatan" | "avatar_url" | "theme_preference">>) => {
      if (!user) return { success: false, error: "User tidak ditemukan." };

      const updatePayload: Record<string, unknown> = {};
      if (typeof updates.name !== "undefined") updatePayload.name = updates.name;
      if (typeof updates.biro !== "undefined") updatePayload.biro = updates.biro;
      if (typeof updates.jabatan !== "undefined") updatePayload.jabatan = updates.jabatan;
      if (typeof updates.avatar_url !== "undefined") updatePayload.avatar_url = updates.avatar_url;

      let emailChangeMessage: string | undefined;

      if (typeof updates.email !== "undefined" || typeof updates.password !== "undefined") {
        const { error: authUpdateError } = await supabase.auth.updateUser({
          email: updates.email,
          password: updates.password,
        });

        if (authUpdateError) {
          return { success: false, error: authUpdateError.message };
        }

        if (typeof updates.email !== "undefined" && updates.email !== user.email) {
          emailChangeMessage = "Permintaan ganti email dikirim. Cek email lama dan email baru untuk konfirmasi perubahan.";
        }
      }

      const { error } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("id", user.id);

      if (error) {
        return { success: false, error: "Gagal memperbarui profil." };
      }

      if (user.role === "HR" || user.role === "PH") {
        const { data: existingAdminProfile } = await supabase
          .from("admin_profiles")
          .select("availability_status, wa_number")
          .eq("user_id", user.id)
          .maybeSingle();

        const mergedName =
          typeof updates.name !== "undefined" ? updates.name : user.name;
        const mergedJabatan =
          typeof updates.jabatan !== "undefined" ? updates.jabatan : user.jabatan;
        const mergedAvatar =
          typeof updates.avatar_url !== "undefined"
            ? updates.avatar_url ?? ""
            : user.avatar_url ?? "";

        await supabase.from("admin_profiles").upsert({
          user_id: user.id,
          display_name: mergedName,
          jabatan_display: JABATAN_LABELS[mergedJabatan],
          availability_status: existingAdminProfile?.availability_status ?? "OFFLINE",
          wa_number: existingAdminProfile?.wa_number ?? "",
          avatar_url: mergedAvatar,
        });
      }

      const updated: User = {
        ...user,
        ...updates,
      };
      setUser(updated);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));

      return { success: true, message: emailChangeMessage };
    },
    [user]
  );

  const role: UserRole | null = user?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isSender: role === "MEMBER" || role === "HR",
        isHr: role === "HR",
        isPh: role === "PH",
        login,
        register,
        logout,
        allUsers: users,
        refreshUsers,
        syncProfileNow,
        updateProfile,
        changeUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
