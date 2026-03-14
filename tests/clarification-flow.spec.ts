import { test, expect } from "@playwright/test";
import {
  ensureClarificationOpenFromPH,
  hardResetToLogin,
  login,
  readE2EEnv,
  resolveSenderOwnedReportId,
} from "./helpers/e2e-helpers";

test.describe("Clarification flow", () => {
  test("PH can open clarification and sender can reach the same chat from report detail and Ruang Curhat", async ({ page }) => {
    const env = readE2EEnv();
    test.skip(!env, "Set E2E_* env vars to run this scenario.");

    const reportId = await resolveSenderOwnedReportId(page, env!);
    test.skip(!reportId, "Sender report precondition unavailable for clarification flow.");
    await ensureClarificationOpenFromPH(page, env!, reportId);

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
