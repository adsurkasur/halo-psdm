import { test, expect } from "@playwright/test";
import { hardResetToLogin, login, readE2EEnv } from "./helpers/e2e-helpers";

test.describe("Role route guard", () => {
  test("MEMBER is blocked while HR and PH can access elevated routes", async ({ page }) => {
    const env = readE2EEnv();
    test.skip(!env, "Set E2E_* sender/PH env vars to run this scenario.");
    test.skip(!env?.hrEmail || !env.hrPassword, "Set E2E_HR_EMAIL and E2E_HR_PASSWORD for HR route guard verification.");

    await login(page, env.senderEmail, env.senderPassword);
    await expect(page).toHaveURL(/\/$|\/dashboard$/);

    await page.goto("/admin/dasbor");
    await expect(page).not.toHaveURL(/\/admin\/dasbor$/);
    await expect(page.getByRole("heading", { name: "Dasbor PH" })).toHaveCount(0);

    await page.goto("/admin/janji-temu");
    await expect(page).not.toHaveURL(/\/admin\/janji-temu$/);
    await expect(page.getByRole("heading", { name: "Tracking Janji Temu" })).toHaveCount(0);

    await hardResetToLogin(page);

    await login(page, env.hrEmail!, env.hrPassword!);
    await expect(page).toHaveURL(/\/$|\/dashboard$/);

    await page.goto("/admin/dasbor");
    await expect(page.getByRole("heading", { name: "Dasbor PH" })).toBeVisible();

    await page.goto("/admin/janji-temu");
    await expect(page.getByRole("heading", { name: "Tracking Janji Temu" })).toBeVisible();

    await hardResetToLogin(page);

    await login(page, env.phEmail, env.phPassword);
    await expect(page).toHaveURL(/\/admin\/dasbor|\/$/);

    await page.goto("/admin/dasbor");
    await expect(page.getByRole("heading", { name: "Dasbor PH" })).toBeVisible();

    await page.goto("/admin/janji-temu");
    await expect(page.getByRole("heading", { name: "Tracking Janji Temu" })).toBeVisible();
  });
});
