import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DataProvider } from "@/contexts/DataContext";
import { ThemeProvider } from "next-themes";
import { AppRoutes } from "@/App";
import { AppHeader } from "@/components/layout/AppHeader";
import ProfilePage from "@/pages/ProfilePage";
import AdminManagement from "@/pages/admin/AdminManagement";
import { Toaster } from "@/components/ui/toaster";
import { mockUsers } from "@/data/mockData";
import React, { useEffect } from "react";

// helper component to auto-login a test user
interface AutoLoginProps {
  children: React.ReactNode;
  email?: string;
  password?: string;
}
function AutoLogin({ children, email, password }: AutoLoginProps) {
  const { login } = useAuth();
  useEffect(() => {
    const cred = email ?? mockUsers[0].email;
    const pass = password ?? mockUsers[0].password;
    login(cred, pass);
  }, [login, email, password]);
  return <>{children}</>;
}

describe("app behavior", () => {
  it("redirects legacy /dashboard path to the sender dashboard", async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system">
        <AuthProvider>
          <DataProvider>
            <MemoryRouter initialEntries={["/dashboard"]}>
              <AutoLogin>
                <AppRoutes />
              </AutoLogin>
            </MemoryRouter>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    );

    // wait for greeting text which appears on sender dashboard
    await waitFor(() => {
      expect(screen.getByText(/Halo, /i)).toBeInTheDocument();
    });
  });

  it("profile card shows jabatan label and popover controls", async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system">
        <AuthProvider>
          <DataProvider>
            <MemoryRouter>
              <AutoLogin>
                <SidebarProvider>
                  <AppHeader />
                </SidebarProvider>
              </AutoLogin>
            </MemoryRouter>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    );

    // profile card displays
    expect(await screen.findByText("Anggota Muda")).toBeInTheDocument();

    // click on name to open popover
    fireEvent.click(screen.getByText(/Ade Surya Ananda/i));

    // popover options appear
    expect(await screen.findByText(/Pengaturan Akun/i)).toBeInTheDocument();
    expect(screen.getByText(/Dark Mode|Light Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Keluar/i)).toBeInTheDocument();

    // toggle theme via popover button
    const themeBtn = screen.getByRole("button", { name: /Dark Mode|Light Mode/i });
    fireEvent.click(themeBtn);
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));
    fireEvent.click(themeBtn);
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(false));
  });

  it("admin login redirects to admin dashboard", async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system">
        <AuthProvider>
          <DataProvider>
            <MemoryRouter initialEntries={["/login"]}>
              <AutoLogin email={mockUsers.find((u) => u.role === "ADMIN")!.email} password="sarah123">
                <AppRoutes />
              </AutoLogin>
            </MemoryRouter>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    );

    // Since AutoLogin triggers login immediately, we expect to land on admin dashboard
    await waitFor(() => {
      // dashboard should show admin-specific navigation link
      expect(screen.getByText("Kelola Laporan")).toBeInTheDocument();
    });
  });

  it("profile page allows editing and saves changes", async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system">
        <AuthProvider>
          <DataProvider>
            <MemoryRouter initialEntries={["/profile"]}>
              <AutoLogin>
                <Toaster />
                <ProfilePage />
              </AutoLogin>
            </MemoryRouter>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    );

    // ensure fields prefilled
    const nameInput = await screen.findByDisplayValue(/Ade Surya Ananda/i);
    expect(nameInput).toBeInTheDocument();
    const emailInput = screen.getByDisplayValue(/ade@arsc.org/i);
    // change some values
    fireEvent.change(nameInput, { target: { value: "Test User" } });
    fireEvent.change(emailInput, { target: { value: "test@arsc.org" } });
    fireEvent.click(screen.getByText(/Simpan/i));

    // toast should appear
    expect(await screen.findByText(/Profil diperbarui/i)).toBeInTheDocument();
  });

  it("renders admin management page and supports search", async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system">
        <AuthProvider>
          <DataProvider>
            <MemoryRouter initialEntries={["/admin/kelola-admin"]}>
              <AutoLogin email={mockUsers.find((u) => u.role === "SUPER_ADMIN")!.email} password="dimas123">
                <AdminManagement />
              </AutoLogin>
            </MemoryRouter>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    );

    expect(await screen.findByText(/Kelola Admin/i)).toBeInTheDocument();
    const search = screen.getByPlaceholderText(/Cari admin/i);
    expect(search).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "Sarah" } });
    await waitFor(() => expect(screen.getAllByText(/Sarah Amelia/i).length).toBeGreaterThan(0));
    // check add-user combo-search exists and shows dropdown when focused
    const addSearch = screen.getByPlaceholderText(/Cari atau pilih pengirim/i);
    expect(addSearch).toBeInTheDocument();
    fireEvent.focus(addSearch);
    await waitFor(() => expect(screen.getByText(/Ade Surya Ananda/i)).toBeInTheDocument());
  });
});
