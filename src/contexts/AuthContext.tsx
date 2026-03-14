import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
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
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  allUsers: User[];
  refreshUsers: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<User, "name" | "password" | "email" | "biro" | "jabatan">>) => Promise<{ success: boolean; error?: string }>;
  changeUserRole: (userId: string, newRole: UserRole) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAppUserById = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, biro, jabatan, role, email, password_hash, is_active, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data || !data.is_active) {
      setUser(null);
      return;
    }

    setUser(mapRowToUser(data as UsersRow));
  }, []);

  const refreshUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, biro, jabatan, role, email, password_hash, is_active, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      return;
    }

    setUsers((data ?? []).map((row) => mapRowToUser(row as UsersRow)));
  }, []);

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

      const { data, error } = await supabase
        .from("users")
        .select("id, name, biro, jabatan, role, email, password_hash, is_active, created_at")
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
    [refreshUsers]
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

      const now = new Date().toISOString();
      const insertPayload = {
        id: authData.user.id,
        name: data.name,
        email: data.email,
        biro: data.biro,
        jabatan: data.jabatan,
        role: "SENDER",
        is_active: true,
        created_at: now,
      };

      const { error } = await supabase.from("users").upsert(insertPayload);
      if (error) {
        return { success: false, error: "Akun auth dibuat, tetapi profil pengguna gagal disimpan." };
      }

      const newUser: User = {
        id: authData.user.id,
        name: data.name,
        email: data.email,
        biro: data.biro,
        jabatan: data.jabatan,
        role: "SENDER",
        is_active: true,
        created_at: now,
      };

      await refreshUsers();
      setUser(newUser);
      return { success: true };
    },
    [users, refreshUsers]
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
    async (updates: Partial<Pick<User, "name" | "password" | "email" | "biro" | "jabatan">>) => {
      if (!user) return { success: false, error: "User tidak ditemukan." };

      const updatePayload: Record<string, unknown> = {};
      if (typeof updates.name !== "undefined") updatePayload.name = updates.name;
      if (typeof updates.biro !== "undefined") updatePayload.biro = updates.biro;
      if (typeof updates.jabatan !== "undefined") updatePayload.jabatan = updates.jabatan;

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
