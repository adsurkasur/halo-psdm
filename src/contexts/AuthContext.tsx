import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import {
  generateId,
  type User,
  type UserRole,
  type BiroBidang,
  type Jabatan,
} from "@/data/domain";
import { supabase } from "@/lib/supabase/client";

const AUTH_STORAGE_KEY = "halo_psdm_auth_user_id";

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
      const storedUserId = typeof window !== "undefined" ? window.localStorage.getItem(AUTH_STORAGE_KEY) : null;
      await refreshUsers();

      if (storedUserId) {
        const { data, error } = await supabase
          .from("users")
          .select("id, name, biro, jabatan, role, email, password_hash, is_active, created_at")
          .eq("id", storedUserId)
          .maybeSingle();

        if (!error && data && data.is_active) {
          setUser(mapRowToUser(data as UsersRow));
        } else if (typeof window !== "undefined") {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }

      setIsLoading(false);
    };

    void bootstrap();
  }, [refreshUsers]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, biro, jabatan, role, email, password_hash, is_active, created_at")
        .eq("email", email)
        .maybeSingle();

      if (error || !data) {
        return { success: false, error: "Email atau password salah." };
      }

      const found = mapRowToUser(data as UsersRow);
      const passwordFromDb = (data as UsersRow).password_hash ?? "";

      if (!found.is_active || passwordFromDb !== password) {
        return { success: false, error: "Email atau password salah." };
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(AUTH_STORAGE_KEY, found.id);
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

      const newUserId = generateId("u");
      const now = new Date().toISOString();
      const insertPayload = {
        id: newUserId,
        name: data.name,
        email: data.email,
        password_hash: data.password,
        biro: data.biro,
        jabatan: data.jabatan,
        role: "SENDER",
        is_active: true,
        created_at: now,
      };

      const { error } = await supabase.from("users").insert(insertPayload);
      if (error) {
        return { success: false, error: "Registrasi gagal. Silakan coba lagi." };
      }

      const newUser: User = {
        id: newUserId,
        name: data.name,
        email: data.email,
        password: data.password,
        biro: data.biro,
        jabatan: data.jabatan,
        role: "SENDER",
        is_active: true,
        created_at: now,
      };

      if (typeof window !== "undefined") {
        window.localStorage.setItem(AUTH_STORAGE_KEY, newUser.id);
      }

      await refreshUsers();
      setUser(newUser);
      return { success: true };
    },
    [users, refreshUsers]
  );

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
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
      if (typeof updates.email !== "undefined") updatePayload.email = updates.email;
      if (typeof updates.biro !== "undefined") updatePayload.biro = updates.biro;
      if (typeof updates.jabatan !== "undefined") updatePayload.jabatan = updates.jabatan;
      if (typeof updates.password !== "undefined") updatePayload.password_hash = updates.password;

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
