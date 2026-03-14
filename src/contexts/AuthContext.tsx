import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import {
  type User,
  type UserRole,
  type BiroBidang,
  type Jabatan,
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
  password_hash?: string | null;
  is_active: boolean;
  created_at: string;
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
    password: row.password_hash ?? undefined,
    is_active: row.is_active,
    created_at: row.created_at,
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSender: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
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
  refreshUsers: () => Promise<void>;
  syncProfileNow: () => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: Partial<Pick<User, "name" | "password" | "email" | "biro" | "jabatan" | "avatar_url">>) => Promise<{ success: boolean; error?: string }>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      .select("id, name, email, biro, jabatan, avatar_url")
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
      role: "SENDER",
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
      .select("id, name, biro, jabatan, role, email, avatar_url, password_hash, is_active, created_at")
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

  const refreshUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, biro, jabatan, role, email, avatar_url, password_hash, is_active, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      return;
    }

    setUsers((data ?? []).map((row) => mapRowToUser(row as UsersRow)));
  }, []);

  const syncProfileThroughServer = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      return { success: false, error: "Sesi login tidak ditemukan. Silakan login kembali." };
    }

    try {
      const response = await fetch("/api/secure/auth/sync-profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        return {
          success: false,
          error:
            payload?.error ??
            "Sinkronisasi profil via server gagal. Coba lagi sebentar, atau hubungi admin untuk sinkronisasi manual.",
        };
      }

      return { success: true };
    } catch {
      return { success: false, error: "Sinkronisasi profil via server sedang tidak tersedia." };
    }
  }, []);

  const syncProfileNow = useCallback(async () => {
    const { data: authUserData, error: authUserError } = await supabase.auth.getUser();

    if (authUserError || !authUserData.user) {
      return { success: false, error: "Sesi login tidak ditemukan. Silakan login kembali." };
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const serverSync = await syncProfileThroughServer();
      if (serverSync.success) {
        await loadAppUserById(authUserData.user.id);
        await refreshUsers();
        return { success: true };
      }

      const ensured = await ensureAppProfileForAuthUser(authUserData.user);
      if (ensured.success) {
        await loadAppUserById(authUserData.user.id);
        await refreshUsers();
        return { success: true };
      }

      if (attempt < 2) {
        await sleep(500);
      }
    }

    return {
      success: false,
      error:
        "Profil belum bisa disinkronkan saat ini. Coba lagi beberapa saat, atau hubungi admin jika masalah berlanjut.",
    };
  }, [ensureAppProfileForAuthUser, loadAppUserById, refreshUsers, syncProfileThroughServer]);

  useEffect(() => {
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      await refreshUsers();

      const sessionUserId = data.session?.user?.id;
      if (sessionUserId) {
        await loadAppUserById(sessionUserId);
      }

      setIsLoading(false);
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUserId = session?.user?.id;
      if (!sessionUserId) {
        setUser(null);
        return;
      }

      void loadAppUserById(sessionUserId);
      void refreshUsers();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshUsers, loadAppUserById]);

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

      const { data, error } = await supabase
        .from("users")
        .select("id, name, biro, jabatan, role, email, avatar_url, password_hash, is_active, created_at")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (error || !data) {
        return { success: false, error: "Profil pengguna belum tersedia di sistem." };
      }

      const found = mapRowToUser(data as UsersRow);
      if (!found.is_active) {
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
    async (updates: Partial<Pick<User, "name" | "password" | "email" | "biro" | "jabatan" | "avatar_url">>) => {
      if (!user) return { success: false, error: "User tidak ditemukan." };

      const updatePayload: Record<string, unknown> = {};
      if (typeof updates.name !== "undefined") updatePayload.name = updates.name;
      if (typeof updates.biro !== "undefined") updatePayload.biro = updates.biro;
      if (typeof updates.jabatan !== "undefined") updatePayload.jabatan = updates.jabatan;
      if (typeof updates.avatar_url !== "undefined") updatePayload.avatar_url = updates.avatar_url;

      if (typeof updates.email !== "undefined" || typeof updates.password !== "undefined") {
        const { error: authUpdateError } = await supabase.auth.updateUser({
          email: updates.email,
          password: updates.password,
        });

        if (authUpdateError) {
          return { success: false, error: authUpdateError.message };
        }

        if (typeof updates.email !== "undefined") {
          updatePayload.email = updates.email;
        }
      }

      const { error } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("id", user.id);

      if (error) {
        return { success: false, error: "Gagal memperbarui profil." };
      }

      const updated: User = { ...user, ...updates };
      setUser(updated);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));

      return { success: true };
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
        isSender: role === "SENDER",
        isAdmin: role === "ADMIN" || role === "SUPER_ADMIN",
        isSuperAdmin: role === "SUPER_ADMIN",
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
