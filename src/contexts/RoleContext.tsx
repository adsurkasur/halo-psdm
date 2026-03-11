import { createContext, useContext, useState, ReactNode } from "react";

type Role = "sender" | "admin";

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
  isSender: boolean;
  isAdmin: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("sender");

  return (
    <RoleContext.Provider
      value={{ role, setRole, isSender: role === "sender", isAdmin: role === "admin" }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
