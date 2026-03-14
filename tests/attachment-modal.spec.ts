import { test, expect, type Page } from "@playwright/test";
import { hardResetToLogin, login, readE2EEnv } from "./helpers/e2e-helpers";

async function findReportWithPreviewAttachment(page: Page): Promise<string | null> {
  await page.goto("/laporan");
  const rows = page.locator("tbody tr");
  const rowCount = await rows.count();

  for (let index = 0; index < Math.min(rowCount, 10); index += 1) {
    await rows.nth(index).click();
    await expect(page).toHaveURL(/\/laporan\/.+/);

    const hasPreview = (await page.getByTestId("sender-report-attachment-preview").count()) > 0;
    if (hasPreview) {
      return page.url().split("/laporan/")[1]?.split("?")[0] ?? null;
    }

    await page.goto("/laporan");
  }

  return null;
}

test.describe("Attachment modal", () => {
  test("Image/video attachment opens modal (not raw tab) for sender and PH", async ({ page }) => {
    const env = readE2EEnv();
    test.skip(!env, "Set E2E_* sender/PH env vars to run this scenario.");

    await login(page, env!.senderEmail, env!.senderPassword);
    await expect(page).toHaveURL(/\/$|\/dashboard$/);

    let reportId: string | null = null;
    if (env!.reportId) {
      await page.goto(`/laporan/${env!.reportId}`);
      const hasPreview = (await page.getByTestId("sender-report-attachment-preview").count()) > 0;
      if (hasPreview) {
        reportId = env!.reportId;
      }
    }

    if (!reportId) {
      reportId = await findReportWithPreviewAttachment(page);
    }

    test.skip(!reportId, "No sender report with previewable attachment found.");

    await page.goto(`/laporan/${reportId}`);
    await expect(page.getByTestId("sender-report-detail")).toBeVisible();
    await page.getByTestId("sender-report-attachment-preview").click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open in New Tab" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await hardResetToLogin(page);

    await login(page, env!.phEmail, env!.phPassword);
    await expect(page).toHaveURL(/\/admin\/dasbor|\/$/);

    await page.goto(`/admin/laporan/${reportId}`);
    await expect(page.getByText("Detail Laporan", { exact: false })).toBeVisible();
    await expect(page.getByTestId("admin-report-attachment-preview")).toBeVisible();

    await page.getByTestId("admin-report-attachment-preview").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open in New Tab" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
  });
});
