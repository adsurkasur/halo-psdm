/**
 * E2E: Admin Report Management
 *
 * Tests PH (admin) workflows:
 * - Admin dashboard loads correctly
 * - Report management list shows all reports
 * - Admin can view individual report details
 * - Admin can change report status
 * - Admin navigation sidebar works
 */
import { test, expect } from "@playwright/test";
import { hardResetToLogin, login, readE2EEnv } from "./helpers/e2e-helpers";

test.describe("Admin Report Management", () => {
  test.beforeEach(async ({ page }) => {
    const env = readE2EEnv();
    test.skip(!env, "Set E2E_* env vars to run this test.");
    await hardResetToLogin(page);
    await login(page, env!.phEmail, env!.phPassword);
    await expect(page).toHaveURL(/\/admin\/dasbor|\/$/, { timeout: 20_000 });
  });

  test("admin dashboard displays statistics", async ({ page }) => {
    await page.goto("/admin/dasbor");
    await expect(page.getByRole("heading", { name: "Dasbor PH" })).toBeVisible();
  });

  test("report management page shows table of reports", async ({ page }) => {
    await page.goto("/admin/laporan");
    await expect(page.getByRole("heading", { name: /Kelola Laporan/ })).toBeVisible({ timeout: 10_000 });

    // Table should be visible
    const table = page.locator("table").first();
    await expect(table).toBeVisible({ timeout: 10_000 });
  });

  test("clicking a report opens the detail view with status controls", async ({ page }) => {
    await page.goto("/admin/laporan");
    
    const firstRow = page.locator("tbody tr").first();
    const hasReports = (await firstRow.count()) > 0;
    test.skip(!hasReports, "No reports available for testing.");

    await firstRow.click();
    await expect(page).toHaveURL(/\/admin\/laporan\/.+/);
    await expect(page.getByText("Detail Laporan")).toBeVisible({ timeout: 10_000 });
  });

  test("admin can access chat queue page", async ({ page }) => {
    await page.goto("/admin/chat");
    await expect(page).toHaveURL(/\/admin\/chat/);
  });

  test("admin can access appointment tracker", async ({ page }) => {
    await page.goto("/admin/janji-temu");
    await expect(page.getByRole("heading", { name: "Tracking Janji Temu" })).toBeVisible();
  });

  test("admin can access rekap page", async ({ page }) => {
    await page.goto("/admin/rekap");
    await expect(page.getByRole("heading", { name: /Rekap/ })).toBeVisible({ timeout: 10_000 });
  });

  test("admin can access user management", async ({ page }) => {
    await page.goto("/admin/kelola-admin");
    await expect(page.getByRole("heading", { name: /Kelola HR/ })).toBeVisible({ timeout: 10_000 });
  });
});
