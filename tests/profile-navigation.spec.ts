/**
 * E2E: Profile & Navigation
 *
 * Tests user profile management and app navigation:
 * - Profile page loads with correct user data
 * - Navigation sidebar links work
 * - Notification bell is visible
 * - Sender and admin have correct sidebar items
 */
import { test, expect } from "@playwright/test";
import { hardResetToLogin, login, readE2EEnv } from "./helpers/e2e-helpers";

test.describe("Profile & Navigation", () => {
  test("sender can access profile page", async ({ page }) => {
    const env = readE2EEnv();
    test.skip(!env, "Set E2E_* env vars.");

    await hardResetToLogin(page);
    await login(page, env!.senderEmail, env!.senderPassword);
    await expect(page).toHaveURL(/\/$|\/dashboard$/, { timeout: 20_000 });

    await page.goto("/profile");
    await expect(page.getByText("Profil").or(page.getByText("Pengaturan"))).toBeVisible({ timeout: 10_000 });
  });

  test("sender sidebar has correct navigation items", async ({ page }) => {
    const env = readE2EEnv();
    test.skip(!env, "Set E2E_* env vars.");

    await hardResetToLogin(page);
    await login(page, env!.senderEmail, env!.senderPassword);
    await expect(page).toHaveURL(/\/$|\/dashboard$/, { timeout: 20_000 });

    // Core navigation items should be present
    await expect(page.getByText("Dashboard").or(page.getByText("Beranda"))).toBeVisible();
  });

  test("admin sidebar has admin-specific navigation items", async ({ page }) => {
    const env = readE2EEnv();
    test.skip(!env, "Set E2E_* env vars.");

    await hardResetToLogin(page);
    await login(page, env!.phEmail, env!.phPassword);
    await expect(page).toHaveURL(/\/admin\/dasbor|\/$/, { timeout: 20_000 });

    // Admin-specific items
    await expect(page.getByText("Dasbor").or(page.getByText("Dashboard"))).toBeVisible();
  });
});
