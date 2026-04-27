/**
 * E2E: Login & Authentication Flows
 *
 * Tests the real-world login experience including:
 * - Valid login for Sender and PH accounts
 * - Incorrect credentials handling
 * - Post-login redirects by role
 * - Session persistence across page reloads
 * - Logout flow
 */
import { test, expect } from "@playwright/test";
import { hardResetToLogin, login, logout, readE2EEnv } from "./helpers/e2e-helpers";

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await hardResetToLogin(page);
  });

  test("shows login page with Masuk and Daftar tabs", async ({ page }) => {
    await expect(page.getByText("Halo PSDM", { exact: false })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Masuk" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Daftar" }).first()).toBeVisible();
  });

  test("rejects incorrect credentials with error message", async ({ page }) => {
    await page.getByPlaceholder("nama@arsc.org").fill("nonexistent@test.com");
    await page.getByPlaceholder("Masukkan password...").fill("wrongpassword123");
    await page.locator("form").first().getByRole("button", { name: "Masuk" }).click();

    await expect(page.locator(".bg-destructive\\/10")).toBeVisible({ timeout: 15_000 });
  });

  test("sender login redirects to dashboard", async ({ page }) => {
    const env = readE2EEnv();
    test.skip(!env, "Set E2E_* env vars to run this test.");

    await login(page, env!.senderEmail, env!.senderPassword);
    await expect(page).toHaveURL(/\/$|\/dashboard$/, { timeout: 30_000 });
    await expect(page.getByText("Halo,")).toBeVisible({ timeout: 20_000 });
  });

  test("PH login redirects to admin dashboard", async ({ page }) => {
    const env = readE2EEnv();
    test.skip(!env, "Set E2E_* env vars to run this test.");

    await login(page, env!.phEmail, env!.phPassword);
    await expect(page).toHaveURL(/\/admin\/dasbor|\/$/, { timeout: 30_000 });
  });

  test("session persists across page reload", async ({ page }) => {
    const env = readE2EEnv();
    test.skip(!env, "Set E2E_* env vars to run this test.");

    await login(page, env!.senderEmail, env!.senderPassword);
    await expect(page).toHaveURL(/\/$|\/dashboard$/, { timeout: 30_000 });

    await page.reload();
    await page.waitForTimeout(3000);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("logout returns to login page", async ({ page }) => {
    const env = readE2EEnv();
    test.skip(!env, "Set E2E_* env vars to run this test.");

    await login(page, env!.senderEmail, env!.senderPassword);
    await expect(page).toHaveURL(/\/$|\/dashboard$/, { timeout: 30_000 });

    await logout(page);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    // Override beforeEach behavior for this test if needed, but hardResetToLogin ends at /login
    await page.goto("/laporan");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
