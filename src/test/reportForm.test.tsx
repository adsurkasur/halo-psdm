// ResizeObserver is used by some radix/ui components; provide a trivial polyfill for tests
// (matching pattern used elsewhere if needed)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { ThemeProvider } from "next-themes";
import ReportForm from "@/views/sender/ReportForm";
import { Toaster } from "@/components/ui/toaster";
import React, { useEffect } from "react";
import { mockUsers, CATEGORY_LABELS } from "@/data/mockData";

// helper to auto-login a default user
function AutoLogin({ children }: { children: React.ReactNode }) {
  const { login } = useAuth();
  useEffect(() => {
    login(mockUsers[0].email, mockUsers[0].password);
  }, [login]);
  return <>{children}</>;
}

describe("ReportForm validation", () => {
  const setup = (props: { initialCategory?: string; initialChronology?: string } = {}) => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system">
        <AuthProvider>
          <DataProvider>
            <MemoryRouter initialEntries={["/laporan/buat"]}>
              <AutoLogin>
                <Toaster />
                <ReportForm {...props} />
              </AutoLogin>
            </MemoryRouter>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    );
  };

  it("alerts when category is not selected", async () => {
    setup();
    const submit = await screen.findByRole("button", { name: /kirim laporan/i });
    fireEvent.click(submit);
    expect(await screen.findByText(/mohon pilih kategori/i)).toBeInTheDocument();
  });

  it("alerts when chronology is too short", async () => {
    // provide a valid category but leave chronology empty/short
    const firstKey = Object.keys(CATEGORY_LABELS)[0];
    setup({ initialCategory: firstKey });
    const submit = await screen.findByRole("button", { name: /kirim laporan/i });
    fireEvent.click(submit);
    expect(await screen.findByText(/kronologi minimal 50 karakter/i)).toBeInTheDocument();
  });

  it("submits successfully when all fields are valid", async () => {
    const firstKey = Object.keys(CATEGORY_LABELS)[0];
    setup({ initialCategory: firstKey, initialChronology: "a".repeat(55) });
    const submit = await screen.findByRole("button", { name: /kirim laporan/i });
    fireEvent.click(submit);
    expect(await screen.findByText(/berhasil! ✅/i)).toBeInTheDocument();
  });
});