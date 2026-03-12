import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  mockUsers,
  generateId,
  type User,
  type UserRole,
  type BiroBidang,
  type Jabatan,
} from "@/data/mockData";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isSender: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  register: (data: {
    name: string;
    email: string;
    password: string;
    biro: BiroBidang;
    jabatan: Jabatan;
  }) => { success: boolean; error?: string };
  logout: () => void;
  allUsers: User[];
  updateProfile: (updates: Partial<Pick<User, "name" | "password" | "email" | "biro" | "jabatan">>) => void;
  changeUserRole: (userId: string, newRole: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(mockUsers);

  const login = useCallback(
    (email: string, password: string) => {
      const found = users.find(
        (u) => u.email === email && u.password === password && u.is_active
      );
      if (!found) {
        return { success: false, error: "Email atau password salah." };
      }
      setUser(found);
      return { success: true };
    },
    [users]
  );

  const register = useCallback(
    (data: { name: string; email: string; password: string; biro: BiroBidang; jabatan: Jabatan }) => {
      const exists = users.find((u) => u.email === data.email);
      if (exists) {
        return { success: false, error: "Email sudah terdaftar." };
      }
      if (data.password.length < 6) {
        return { success: false, error: "Password minimal 6 karakter." };
      }
      const newUser: User = {
        id: generateId("u"),
        name: data.name,
        email: data.email,
        password: data.password,
        biro: data.biro,
        jabatan: data.jabatan,
        role: "SENDER",
        is_active: true,
        created_at: new Date().toISOString(),
      };
      setUsers((prev) => [...prev, newUser]);
      setUser(newUser);
      return { success: true };
    },
    [users]
  );

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const changeUserRole = useCallback(
    (userId: string, newRole: UserRole) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      if (user && user.id === userId) {
        setUser({ ...user, role: newRole });
      }
    },
    [user]
  );

  const updateProfile = useCallback(
    (updates: Partial<Pick<User, "name" | "password" | "email" | "biro" | "jabatan">>) => {
      if (!user) return;
      const updated: User = { ...user, ...updates } as User;
      setUser(updated);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    },
    [user]
  );

  const role: UserRole | null = user?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isSender: role === "SENDER",
        isAdmin: role === "ADMIN" || role === "SUPER_ADMIN",
        isSuperAdmin: role === "SUPER_ADMIN",
        login,
        register,
        logout,
        allUsers: users,
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
