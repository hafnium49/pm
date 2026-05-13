import { expect, test, type Page } from "@playwright/test";

function uniqueUsername(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

async function registerAndOpen(page: Page, username: string) {
  await page.goto("/register/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill("supersecret");
  await page.getByLabel("Confirm password").fill("supersecret");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.getByRole("heading", { name: "Kanban Studio" }).waitFor();
}

test("account button in header shows the current username and opens settings", async ({ page }) => {
  const u = uniqueUsername("acct1");
  await registerAndOpen(page, u);
  await expect(page.getByRole("button", { name: /account settings/i })).toContainText(u);

  await page.getByRole("button", { name: /account settings/i }).click();
  await expect(page.getByRole("dialog", { name: /account settings/i })).toBeVisible();
});

test("change password, then log in with the new password", async ({ page }) => {
  const u = uniqueUsername("acct2");
  await registerAndOpen(page, u);
  await page.getByRole("button", { name: /account settings/i }).click();
  await page.getByLabel("Current password").fill("supersecret");
  await page.getByLabel("New password", { exact: true }).fill("brandnew1");
  await page.getByLabel("Confirm new password").fill("brandnew1");
  await page.getByRole("button", { name: /save password/i }).click();
  await expect(page.getByTestId("pw-success")).toBeVisible();

  // Log out and back in with the new password
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL(/\/login/);
  await page.getByLabel("Username").fill(u);
  await page.getByLabel("Password").fill("brandnew1");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.getByRole("heading", { name: "Kanban Studio" }).waitFor();
});

test("mismatching new+confirm shows an error and does not call the server", async ({ page }) => {
  const u = uniqueUsername("acct3");
  await registerAndOpen(page, u);
  await page.getByRole("button", { name: /account settings/i }).click();
  await page.getByLabel("Current password").fill("supersecret");
  await page.getByLabel("New password", { exact: true }).fill("brandnew1");
  await page.getByLabel("Confirm new password").fill("different1");
  await page.getByRole("button", { name: /save password/i }).click();
  await expect(page.getByTestId("pw-error")).toContainText(/do not match/i);
});

test("wrong current password is rejected by the server", async ({ page }) => {
  const u = uniqueUsername("acct4");
  await registerAndOpen(page, u);
  await page.getByRole("button", { name: /account settings/i }).click();
  await page.getByLabel("Current password").fill("not-correct");
  await page.getByLabel("New password", { exact: true }).fill("brandnew1");
  await page.getByLabel("Confirm new password").fill("brandnew1");
  await page.getByRole("button", { name: /save password/i }).click();
  await expect(page.getByTestId("pw-error")).toContainText(/incorrect/i);
});

test("change username updates the header chip and survives reload", async ({ page }) => {
  const u = uniqueUsername("acct5");
  const v = uniqueUsername("renamed");
  await registerAndOpen(page, u);
  await page.getByRole("button", { name: /account settings/i }).click();
  await page.getByLabel("New username").fill(v);
  await page.getByLabel("Confirm with password").fill("supersecret");
  await page.getByRole("button", { name: /save username/i }).click();
  await expect(page.getByTestId("un-success")).toBeVisible();
  // Header reflects the new username
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /account settings/i })).toContainText(v);
  // Reload — still signed in as new name
  await page.reload();
  await page.getByRole("heading", { name: "Kanban Studio" }).waitFor();
  await expect(page.getByRole("button", { name: /account settings/i })).toContainText(v);
});

test("username conflict is reported to the user", async ({ page }) => {
  const taken = uniqueUsername("taken");
  await registerAndOpen(page, taken);
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL(/\/login/);
  const mine = uniqueUsername("mine");
  await registerAndOpen(page, mine);
  await page.getByRole("button", { name: /account settings/i }).click();
  await page.getByLabel("New username").fill(taken);
  await page.getByLabel("Confirm with password").fill("supersecret");
  await page.getByRole("button", { name: /save username/i }).click();
  await expect(page.getByTestId("un-error")).toContainText(/taken/i);
});

test("delete account requires confirmation text and redirects to login", async ({ page }) => {
  const u = uniqueUsername("acct6");
  await registerAndOpen(page, u);
  await page.getByRole("button", { name: /account settings/i }).click();
  // Without the magic phrase the form refuses
  await page.getByLabel("Confirm password for deletion").fill("supersecret");
  await page.getByLabel("Type to confirm deletion").fill("delete");
  await page.getByRole("button", { name: /delete my account/i }).click();
  await expect(page.getByTestId("del-error")).toContainText(/delete my account/i);

  // Now type the exact phrase
  await page.getByLabel("Type to confirm deletion").fill("delete my account");
  await page.getByRole("button", { name: /delete my account/i }).click();
  await page.waitForURL(/\/login/);

  // Old credentials no longer work
  await page.getByLabel("Username").fill(u);
  await page.getByLabel("Password").fill("supersecret");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
});
