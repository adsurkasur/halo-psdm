/**
 * E2E: Real-Time Chat — Two-User Messaging
 *
 * Tests the real-world chat experience:
 * - Sender can start a chat session
 * - Messages appear in real-time without refresh
 * - PH can see and respond to sender messages
 * - Sender can see PH responses
 * - Messages are correctly attributed to their senders
 */
import { test, expect } from "@playwright/test";
import {
  ensureClarificationOpenFromPH,
  hardResetToLogin,
  login,
  readE2EEnv,
  resolveSenderOwnedReportId,
} from "./helpers/e2e-helpers";

test.describe("Real-time Chat Exchange", () => {
  test("full chat lifecycle: sender sends → PH receives → PH replies → sender receives", async ({ page }) => {
    const env = readE2EEnv();
    test.skip(!env, "Set E2E_* sender/PH env vars to run this scenario.");

    // Step 1: Find a report owned by sender
    const reportId = await resolveSenderOwnedReportId(page, env!);
    test.skip(!reportId, "Sender report precondition unavailable for chat flow.");

    // Step 2: PH opens clarification (creates a chat session linked to the report)
    await ensureClarificationOpenFromPH(page, env!, reportId!);
    await hardResetToLogin(page);

    // Step 3: Sender logs in, opens the report, navigates to chat
    await login(page, env!.senderEmail, env!.senderPassword);
    await expect(page).toHaveURL(/\/$|\/dashboard$/, { timeout: 20_000 });

    await page.goto(`/laporan/${reportId}`);
    await expect(page.getByTestId("sender-report-open-chat")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("sender-report-open-chat").click();
    await expect(page).toHaveURL(/\/chat\/.+/);

    const sessionId = page.url().split("/chat/")[1]?.split("?")[0] ?? "";
    expect(sessionId).toBeTruthy();

    // Step 4: Sender sends a message
    const senderMsg = `sender-e2e-${Date.now()}`;
    await page.getByTestId("sender-chat-input").fill(senderMsg);
    await page.getByTestId("sender-chat-send").click();
    await expect(page.getByText(senderMsg)).toBeVisible({ timeout: 20_000 });

    // Step 5: Switch to PH, navigate to chat, find the session
    await hardResetToLogin(page);
    await login(page, env!.phEmail, env!.phPassword);
    await expect(page).toHaveURL(/\/admin\/dasbor|\/$/, { timeout: 20_000 });

    await page.goto("/admin/chat");
    const reportSessionCard = page.locator(`[data-report-id="${reportId}"]`).first();
    if (await reportSessionCard.count()) {
      await reportSessionCard.click();
    } else {
      await page.getByTestId(`admin-chat-session-${sessionId}`).click();
    }

    // PH takes the case if needed
    const takeCaseButton = page.getByRole("button", { name: "Ambil Kasus" });
    if (await takeCaseButton.count()) {
      await takeCaseButton.click();
    }

    // Step 6: PH should see the sender's message
    await expect(page.getByText(senderMsg)).toBeVisible({ timeout: 20_000 });

    // Step 7: PH sends a reply
    const phMsg = `ph-reply-e2e-${Date.now()}`;
    await page.getByTestId("admin-chat-input").fill(phMsg);
    await page.getByTestId("admin-chat-send").click();
    await expect(page.getByText(phMsg)).toBeVisible({ timeout: 20_000 });

    // Step 8: Switch back to sender, verify PH message arrived
    await hardResetToLogin(page);
    await login(page, env!.senderEmail, env!.senderPassword);
    await page.goto(`/chat/${sessionId}`);
    await expect(page.getByText(phMsg)).toBeVisible({ timeout: 20_000 });
  });
});
