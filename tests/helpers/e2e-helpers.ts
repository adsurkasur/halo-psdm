import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export type E2EEnv = {
  phEmail: string;
  phPassword: string;
  senderEmail: string;
  senderPassword: string;
  hrEmail?: string;
  hrPassword?: string;
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

function getEnvValue(key: string): string {
  return (process.env[key] ?? readEnvFileValue(key)).trim();
}

export function readE2EEnv(): E2EEnv | null {
  const rawReportId = getEnvValue("E2E_REPORT_ID");
  const normalizedReportId = rawReportId.replace(/^https?:\/\/[^/]+\//i, "").replace(/^laporan\//i, "");

  const env: E2EEnv = {
    phEmail: getEnvValue("E2E_PH_EMAIL"),
    phPassword: getEnvValue("E2E_PH_PASSWORD"),
    senderEmail: getEnvValue("E2E_SENDER_EMAIL"),
    senderPassword: getEnvValue("E2E_SENDER_PASSWORD"),
    hrEmail: getEnvValue("E2E_HR_EMAIL") || undefined,
    hrPassword: getEnvValue("E2E_HR_PASSWORD") || undefined,
    reportId: normalizedReportId || undefined,
  };

  const minimumReady = [env.phEmail, env.phPassword, env.senderEmail, env.senderPassword].every(
    (value) => value.trim().length > 0,
  );

  return minimumReady ? env : null;
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("nama@arsc.org").fill(email);
  await page.getByPlaceholder("Masukkan password...").fill(password);
  await page.locator("form").first().getByRole("button", { name: "Masuk" }).click();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Pengaturan Akun" }).click();
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login/);
}

export async function hardResetToLogin(page: Page) {
  try {
    // Navigate to a known page first to establish origin
    await page.goto("/login", { waitUntil: "load" }).catch(() => {});
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {}
    });
  } catch (e) {}
  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "load" });
}

export async function resolveSenderOwnedReportId(page: Page, env: E2EEnv): Promise<string | null> {
  await login(page, env.senderEmail, env.senderPassword);
  if (/\/admin\//.test(page.url())) {
    await hardResetToLogin(page);
    return null;
  }

  if (env.reportId) {
    await page.goto(`/laporan/${env.reportId}`);
    const detailHeading = page.getByText("Detail Laporan", { exact: false });
    const exists = (await detailHeading.count()) > 0;
    if (exists) {
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
    await hardResetToLogin(page);
    return null;
  }

  await expect(page).toHaveURL(/\/laporan\/.+/);
  const discoveredId = page.url().split("/laporan/")[1]?.split("?")[0] ?? "";
  if (!discoveredId) {
    await hardResetToLogin(page);
    return null;
  }

  await hardResetToLogin(page);
  return discoveredId;
}

export async function ensureClarificationOpenFromPH(page: Page, env: E2EEnv, reportId: string) {
  await login(page, env.phEmail, env.phPassword);
  await expect(page).toHaveURL(/\/admin\/dasbor|\/$/);

  await page.goto(`/admin/laporan/${reportId}`);
  await expect(page.getByText("Detail Laporan", { exact: false })).toBeVisible();

  const openChatButton = page.getByTestId("admin-report-open-chat");
  if (await openChatButton.count()) {
    await openChatButton.click();
    await expect(page).toHaveURL(/\/admin\/chat$/);
    return;
  }

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
