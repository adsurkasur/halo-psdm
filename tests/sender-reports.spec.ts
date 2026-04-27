/**
 * E2E: Sender Dashboard & Report Lifecycle
 *
 * Tests the core reporting workflow as a Sender:
 * - Dashboard loads with quick actions
 * - Report creation form validation
 * - Submitting a new report (full lifecycle)
 * - Viewing report details
 * - Report list navigation
 */
import { test, expect } from "@playwright/test";
import { hardResetToLogin, login, readE2EEnv } from "./helpers/e2e-helpers";

test.describe("Sender Dashboard & Reports", () => {
  test.beforeEach(async ({ page }) => {
    const env = readE2EEnv();
    test.skip(!env, "Set E2E_* env vars to run this test.");
    await hardResetToLogin(page);
    await login(page, env!.senderEmail, env!.senderPassword);
    await expect(page).toHaveURL(/\/$|\/dashboard$/, { timeout: 20_000 });
  });

  test("dashboard shows welcome message and quick actions", async ({ page }) => {
    await expect(page.getByText("Halo,")).toBeVisible();
    await expect(page.getByText("Buat Laporan")).toBeVisible();
    await expect(page.getByText("Mulai Sesi Curhat")).toBeVisible();
    await expect(page.getByText("Order Janji Temu")).toBeVisible();
  });

  test("navigates to report creation form", async ({ page }) => {
    await page.getByText("Buat Laporan").click();
    await expect(page).toHaveURL(/\/laporan\/buat/);
    await expect(page.getByText("Buat Laporan / Pengaduan")).toBeVisible();
  });

  test("report form validates required fields", async ({ page }) => {
    await page.goto("/laporan/buat");
    await expect(page.getByText("Buat Laporan / Pengaduan")).toBeVisible();

    // Try submitting without category
    await page.getByRole("button", { name: "Kirim Laporan" }).click();

    // Expect validation toast
    await expect(
      page.getByText("Mohon pilih kategori laporan").or(page.getByText("Kronologi minimal 50 karakter"))
    ).toBeVisible({ timeout: 5_000 });
  });

  test("can create a new report with full form data", async ({ page }) => {
    await page.goto("/laporan/buat");
    await expect(page.getByText("Buat Laporan / Pengaduan")).toBeVisible();

    // Select category
    await page.getByText("Pilih kategori...").click();
    await page.getByRole("option").first().click();

    // Select urgency
    await page.getByLabel("Sedang").click();

    // Fill chronology (min 50 chars)
    const chronology = `E2E test report created at ${new Date().toISOString()} — this is a detailed description of the issue being reported for automated testing purposes.`;
    await page.getByPlaceholder("Ceritakan detail permasalahan").fill(chronology);

    // Submit
    await page.getByRole("button", { name: "Kirim Laporan" }).click();

    // Should redirect to the report detail page
    await expect(page).toHaveURL(/\/laporan\/r_/, { timeout: 30_000 });
  });

  test("report list page shows existing reports", async ({ page }) => {
    await page.goto("/laporan");
    await expect(page.getByText("Laporan Saya").or(page.getByText("Laporan Aktif"))).toBeVisible({ timeout: 10_000 });
  });

  test("clicking a report navigates to detail view", async ({ page }) => {
    await page.goto("/laporan");
    const firstRow = page.locator("tbody tr").first();
    const hasReports = (await firstRow.count()) > 0;
    test.skip(!hasReports, "No existing reports found for this sender.");

    await firstRow.click();
    await expect(page).toHaveURL(/\/laporan\/.+/);
    await expect(page.getByText("Detail Laporan").or(page.getByText("Kronologi"))).toBeVisible({ timeout: 10_000 });
  });
});
