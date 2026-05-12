import { expect, test } from "@playwright/test";

function uniqueUsername(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

test("register a new user, see their board, then log out", async ({ page }) => {
  const username = uniqueUsername("alice");
  await page.goto("/register/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill("supersecret");
  await page.getByLabel("Confirm password").fill("supersecret");
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);

  // Username appears nowhere, but board switcher should show "My Board"
  await expect(page.getByRole("button", { name: /switch board/i })).toContainText("My Board");

  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL(/\/login/);
});

test("register with mismatching passwords blocks submit", async ({ page }) => {
  await page.goto("/register/");
  await page.getByLabel("Username").fill("nomatter");
  await page.getByLabel("Password", { exact: true }).fill("password1");
  await page.getByLabel("Confirm password").fill("password2");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByText(/passwords do not match/i)).toBeVisible();
});

test("invalid username is rejected by server", async ({ page }) => {
  await page.goto("/register/");
  await page.getByLabel("Username").fill("no spaces!");
  await page.getByLabel("Password", { exact: true }).fill("supersecret");
  await page.getByLabel("Confirm password").fill("supersecret");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByText(/username must be 3-32/i)).toBeVisible();
});

test("login → register link", async ({ page }) => {
  await page.goto("/login/");
  await page.getByRole("link", { name: /create an account/i }).click();
  await page.waitForURL(/\/register/);
  await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
});
