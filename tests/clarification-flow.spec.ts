import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type E2EEnv = {
  phEmail: string;
  phPassword: string;
  senderEmail: string;
  senderPassword: string;
  reportId?: string;
};

function readEnvFileValue(key: string): string {
  try {
    const filePath = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(filePath)) return "";

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    const target = lines.find((line) => line.trim().startsWith(`${key}=`));
    if (!target) return "";

    const value = target.slice(target.indexOf("=") + 1).trim();
    return value.replace(/^['"]|['"]$/g, "");
  } catch {
    return "";
  }
}

function readEnv(): E2EEnv | null {
  const phEmail = (process.env.E2E_PH_EMAIL ?? readEnvFileValue("E2E_PH_EMAIL")).trim();
  const phPassword = (process.env.E2E_PH_PASSWORD ?? readEnvFileValue("E2E_PH_PASSWORD")).trim();
  const senderEmail = (process.env.E2E_SENDER_EMAIL ?? readEnvFileValue("E2E_SENDER_EMAIL")).trim();
  const senderPassword = (process.env.E2E_SENDER_PASSWORD ?? readEnvFileValue("E2E_SENDER_PASSWORD")).trim();
  const rawReportId = (process.env.E2E_REPORT_ID ?? readEnvFileValue("E2E_REPORT_ID")).trim();
  const normalizedReportId = rawReportId.replace(/^https?:\/\/[^/]+\//i, "").replace(/^laporan\//i, "");

  const env: E2EEnv = {
    phEmail,
    phPassword,
    senderEmail,
    senderPassword,
    reportId: normalizedReportId || undefined,
  };

  const isReady = [env.phEmail, env.phPassword, env.senderEmail, env.senderPassword].every(
    (value) => value.trim().length > 0,
  );
  return isReady ? env : null;
}

async function login(page: Parameters<typeof test>[0]["page"], email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("nama@arsc.org").fill(email);
  await page.getByPlaceholder("Masukkan password...").fill(password);
  await page.locator("form").first().getByRole("button", { name: "Masuk" }).click();
}

async function hardResetToLogin(page: Parameters<typeof test>[0]["page"]) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
  await page.goto("/login");
}

async function resolveSenderOwnedReportId(
  page: Parameters<typeof test>[0]["page"],
  env: E2EEnv,
): Promise<string> {
  await login(page, env.senderEmail, env.senderPassword);
  await expect(page).toHaveURL(/\/$|\/dashboard$/);

  if (env.reportId) {
    await page.goto(`/laporan/${env.reportId}`);
    const detailHeading = page.getByText("Detail Laporan", { exact: false });
    if (await detailHeading.count()) {
      const visible = await detailHeading.first().isVisible().catch(() => false);
      if (visible) {
        await hardResetToLogin(page);
        return env.reportId;
      }
    }
  }

  await page.goto("/laporan");
  const firstRow = page.locator("tbody tr").first();
  const hasExistingReport = (await firstRow.count()) > 0;

  if (hasExistingReport) {
    await firstRow.click();
  } else {
    await page.goto("/laporan/buat");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Konflik Antar Anggota" }).click();
    await page
      .getByPlaceholder("Ceritakan detail permasalahan yang Anda alami (min. 50 karakter)...")
      .fill("Laporan otomatis untuk validasi alur klarifikasi end-to-end antara PH dan sender di Halo PSDM.");
    await page.getByRole("button", { name: "Kirim Laporan" }).click();
  }

  await expect(page).toHaveURL(/\/laporan\/.+/);
  const discoveredId = page.url().split("/laporan/")[1]?.split("?")[0] ?? "";
  expect(discoveredId).toBeTruthy();

  await hardResetToLogin(page);
  return discoveredId;
}

test.describe("Clarification flow", () => {
  test("PH can open clarification and sender can reach the same chat from report detail and Ruang Curhat", async ({ page }) => {
    const env = readEnv();
    test.skip(!env, "Set E2E_* env vars to run this scenario.");

    const reportId = await resolveSenderOwnedReportId(page, env!);

    await login(page, env!.phEmail, env!.phPassword);
    await expect(page).toHaveURL(/\/admin\/dasbor|\/$/);

    await page.goto(`/admin/laporan/${reportId}`);
    await expect(page.getByText("Detail Laporan", { exact: false })).toBeVisible();

    const openChatButton = page.getByTestId("admin-report-open-chat");
    if (await openChatButton.count()) {
      await openChatButton.click();
      await expect(page).toHaveURL(/\/admin\/chat$/);
    } else {
      await page.getByTestId("admin-report-status-trigger").click();
      await page.getByRole("option", { name: "Membutuhkan Klarifikasi" }).click();
      const updateButton = page.getByTestId("admin-report-update-status");

      if (await updateButton.isDisabled()) {
        await page.getByTestId("admin-report-status-trigger").click();
        await page.getByRole("option", { name: "Dalam Proses" }).click();
        await updateButton.click();
        await expect(updateButton).toBeDisabled({ timeout: 10_000 });

        await page.getByTestId("admin-report-status-trigger").click();
        await page.getByRole("option", { name: "Membutuhkan Klarifikasi" }).click();
      }

      await updateButton.click();
      await page.goto("/admin/chat");
      await expect(page).toHaveURL(/\/admin\/chat$/);
    }

    await hardResetToLogin(page);

    await login(page, env!.senderEmail, env!.senderPassword);
    await expect(page).toHaveURL(/\/$|\/dashboard$/);

    await page.goto(`/laporan/${reportId}`);
    await expect(page.getByText("Detail Laporan", { exact: false })).toBeVisible();
    await page.getByTestId("sender-report-open-chat").click();

    await expect(page).toHaveURL(/\/chat\/.+/);
    const chatFromReportUrl = page.url();
    const chatFromReportSessionId = chatFromReportUrl.split("/chat/")[1]?.split("?")[0];
    expect(chatFromReportSessionId).toBeTruthy();

    await page.goto("/chat");
    await expect(page.getByRole("heading", { name: "Ruang Curhat" })).toBeVisible();

    const reportSessionCard = page.locator(`[data-report-id="${reportId}"]`).first();
    await expect(reportSessionCard).toBeVisible({ timeout: 20_000 });
    await reportSessionCard.click();

    await expect(page).toHaveURL(new RegExp(`/chat/${chatFromReportSessionId}$`));
  });
});
