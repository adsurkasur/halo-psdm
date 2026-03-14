import { test, expect } from "@playwright/test";
import {
  ensureClarificationOpenFromPH,
  hardResetToLogin,
  login,
  readE2EEnv,
  resolveSenderOwnedReportId,
} from "./helpers/e2e-helpers";

test.describe("Chat reliability", () => {
  test("Sender and PH can exchange messages in the same clarification session", async ({ page }) => {
    const env = readE2EEnv();
    test.skip(!env, "Set E2E_* sender/PH env vars to run this scenario.");

    const reportId = await resolveSenderOwnedReportId(page, env!);
    test.skip(!reportId, "Sender report precondition unavailable for chat reliability flow.");
    await ensureClarificationOpenFromPH(page, env!, reportId);

    await hardResetToLogin(page);

    await login(page, env!.senderEmail, env!.senderPassword);
    await expect(page).toHaveURL(/\/$|\/dashboard$/);

    await page.goto(`/laporan/${reportId}`);
    await expect(page.getByTestId("sender-report-open-chat")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("sender-report-open-chat").click();

    await expect(page).toHaveURL(/\/chat\/.+/);
    const sessionId = page.url().split("/chat/")[1]?.split("?")[0] ?? "";
    expect(sessionId).toBeTruthy();

    const senderText = `sender-e2e-${Date.now()}`;
    await page.getByTestId("sender-chat-input").fill(senderText);
    await page.getByTestId("sender-chat-send").click();
    await expect(page.getByText(senderText)).toBeVisible({ timeout: 20_000 });

    await hardResetToLogin(page);

    await login(page, env!.phEmail, env!.phPassword);
    await expect(page).toHaveURL(/\/admin\/dasbor|\/$/);

    await page.goto("/admin/chat");
    const reportSessionCard = page.locator(`[data-report-id="${reportId}"]`).first();
    if (await reportSessionCard.count()) {
      await reportSessionCard.click();
    } else {
      await page.getByTestId(`admin-chat-session-${sessionId}`).click();
    }

    const takeCaseButton = page.getByRole("button", { name: "Ambil Kasus" });
    if (await takeCaseButton.count()) {
      await takeCaseButton.click();
    }

    await expect(page.getByText(senderText)).toBeVisible({ timeout: 20_000 });

    const phText = `ph-e2e-${Date.now()}`;
    await page.getByTestId("admin-chat-input").fill(phText);
    await page.getByTestId("admin-chat-send").click();
    await expect(page.getByText(phText)).toBeVisible({ timeout: 20_000 });

    await hardResetToLogin(page);

    await login(page, env!.senderEmail, env!.senderPassword);
    await page.goto(`/chat/${sessionId}`);
    await expect(page.getByText(phText)).toBeVisible({ timeout: 20_000 });
  });
});
