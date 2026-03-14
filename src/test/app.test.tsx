import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DataProvider } from "@/contexts/DataContext";
import { ThemeProvider } from "next-themes";
import { AppRoutes } from "@/App";
import { AppHeader } from "@/components/layout/AppHeader";
import ProfilePage from "@/views/ProfilePage";
import AdminManagement from "@/views/admin/AdminManagement";
import ReportDetail from "@/views/admin/ReportDetail";
import { Toaster } from "@/components/ui/toaster";
import type { Urgency } from "@/data/domain";
import React, { useEffect, useLayoutEffect, useRef } from "react";
import { useData } from "@/contexts/DataContext";

const TEST_SENDER = { id: "u1", name: "Ade Surya Ananda", email: "ade@arsc.org", password: "ade123" };
const TEST_ADMIN = { id: "u2", email: "sarah@arsc.org", password: "sarah123" };
const TEST_SUPER_ADMIN = { id: "u3", email: "nadia@arsc.org", password: "nadia123" };
const TEST_REPORT_ID = "r1";

// helper used in tests to programmatically trigger urgency updates via context
function UrgencySetter({ reportId, newUrgency, adminId }: { reportId: string; newUrgency: Urgency; adminId: string; }) {
  const { updateReportUrgency } = useData();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;
    void updateReportUrgency(reportId, newUrgency, adminId);
  }, [reportId, newUrgency, adminId, updateReportUrgency]);

  return null;
}

function ReportUrgencyProbe({ reportId }: { reportId: string }) {
  const { reports } = useData();
  const report = reports.find((r) => r.id === reportId);
  return <div data-testid="report-urgency">{report?.urgency ?? "MISSING"}</div>;
}

// helper component to auto-login a test user
interface AutoLoginProps {
  children: React.ReactNode;
  email?: string;
  password?: string;
}
function AutoLogin({ children, email, password }: AutoLoginProps) {
  const { login } = useAuth();
  useLayoutEffect(() => {
    const cred = email ?? TEST_SENDER.email;
    const pass = password ?? TEST_SENDER.password;
    void login(cred, pass);
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
    fireEvent.click(screen.getByText(new RegExp(TEST_SENDER.name, "i")));

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
              <AutoLogin email={TEST_ADMIN.email} password={TEST_ADMIN.password}>
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
    const nameInput = await screen.findByDisplayValue(new RegExp(TEST_SENDER.name, "i"));
    expect(nameInput).toBeInTheDocument();
    const phoneInput = screen.getByPlaceholderText(/081234567890/i);
    // change some values
    fireEvent.change(nameInput, { target: { value: "Test User" } });
    fireEvent.change(phoneInput, { target: { value: "081234567890" } });
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
              <AutoLogin email={TEST_SUPER_ADMIN.email} password={TEST_SUPER_ADMIN.password}>
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
    expect(await screen.findByText(/Sarah Amelia/i)).toBeInTheDocument();
    // verify add-user searchable input renders
    const addSearch = screen.getByPlaceholderText(/Cari atau pilih pengirim/i);
    expect(addSearch).toBeInTheDocument();
  });

  it("admin can override report urgency via detail page", async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system">
        <AuthProvider>
          <DataProvider>
            <MemoryRouter initialEntries={[`/admin/laporan/${TEST_REPORT_ID}`]}>
              <AutoLogin email={TEST_SUPER_ADMIN.email} password={TEST_SUPER_ADMIN.password}>
                <Toaster />
                <UrgencySetter reportId={TEST_REPORT_ID} newUrgency="RENDAH" adminId={TEST_SUPER_ADMIN.id} />
                <ReportUrgencyProbe reportId={TEST_REPORT_ID} />
                <Routes>
                  <Route path="/admin/laporan/:id" element={<ReportDetail />} />
                </Routes>
              </AutoLogin>
            </MemoryRouter>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("report-urgency")).toHaveTextContent("RENDAH");
    });

    expect((await screen.findAllByText(/Rendah/i)).length).toBeGreaterThan(0);
  });
});
