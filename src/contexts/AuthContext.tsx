import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { mockUsers, type User, type UserRole } from "@/data/mockData";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isSender: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback((email: string, password: string) => {
    const found = mockUsers.find(
      (u) => u.email === email && u.password === password && u.is_active
    );
    if (!found) {
      return { success: false, error: "Email atau password salah." };
    }
    setUser(found);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

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
        logout,
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
