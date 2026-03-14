import { test, expect } from "@playwright/test";
import { hardResetToLogin, login, readE2EEnv } from "./helpers/e2e-helpers";

test.describe("Appointment tracking", () => {
  test("PH can mark appointment done and sender can request again", async ({ page }) => {
    const env = readE2EEnv();
    test.skip(!env, "Set E2E_* sender/PH env vars to run this scenario.");

    await login(page, env!.senderEmail, env!.senderPassword);
    test.skip(/\/admin\//.test(page.url()), "Sender credentials are not routed to sender area.");

    await page.goto("/janji-temu");

    const firstContactButton = page.locator('[data-testid^="appointment-contact-"]').first();
    const hasContactButton = (await firstContactButton.count()) > 0;
    test.skip(!hasContactButton, "No appointment targets available for sender account.");
    await expect(firstContactButton).toBeVisible({ timeout: 20_000 });

    const targetTestId = await firstContactButton.getAttribute("data-testid");
    const targetAdminId = targetTestId?.replace("appointment-contact-", "") ?? "";
    expect(targetAdminId).toBeTruthy();

    // Ignore popup timing variance; the core behavior we validate is appointment logging.
    await firstContactButton.click();

    await hardResetToLogin(page);

    await login(page, env!.phEmail, env!.phPassword);
    await expect(page).toHaveURL(/\/admin\/dasbor|\/$/);

    await page.goto("/admin/janji-temu");
    await expect(page.getByRole("heading", { name: "Tracking Janji Temu" })).toBeVisible();

    const openBeforeDone = page.locator('[data-testid^="appointment-done-"]');
    await expect(openBeforeDone.first()).toBeVisible({ timeout: 20_000 });

    const firstDoneButton = openBeforeDone.first();
    const doneTestId = await firstDoneButton.getAttribute("data-testid");
    const appointmentId = doneTestId?.replace("appointment-done-", "") ?? "";
    expect(appointmentId).toBeTruthy();

    const noteInput = page.getByTestId(`appointment-note-${appointmentId}`);
    await noteInput.fill("Selesai ditindaklanjuti melalui koordinasi langsung.");
    await firstDoneButton.click();

    const trackedRow = page.getByTestId(`appointment-row-${appointmentId}`);
    await expect(trackedRow.getByText("Selesai")).toBeVisible({ timeout: 20_000 });

    const openCountBeforeRetry = await page.locator('[data-testid^="appointment-done-"]').count();

    await hardResetToLogin(page);

    await login(page, env!.senderEmail, env!.senderPassword);
    await expect(page).toHaveURL(/\/$|\/dashboard$/);

    await page.goto("/janji-temu");
    await expect(page.getByTestId(`appointment-contact-${targetAdminId}`)).toBeVisible({ timeout: 20_000 });
    await page.getByTestId(`appointment-contact-${targetAdminId}`).click();

    await hardResetToLogin(page);

    await login(page, env!.phEmail, env!.phPassword);
    await page.goto("/admin/janji-temu");

    await expect(async () => {
      const openCountAfterRetry = await page.locator('[data-testid^="appointment-done-"]').count();
      expect(openCountAfterRetry).toBeGreaterThanOrEqual(openCountBeforeRetry + 1);
    }).toPass({ timeout: 20_000 });
  });
});
