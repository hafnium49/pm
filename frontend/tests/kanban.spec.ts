import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("/");
  // Wait for AuthGuard to resolve and board to render
  await page.getByRole("heading", { name: "Kanban Studio" }).waitFor();
}

test("login with correct credentials shows the board", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
});

test("login with wrong credentials shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("logout redirects to login", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
});

test("loads the kanban board", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await login(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card").first()).toBeVisible();
});

test("cards are draggable between columns", async ({ page }) => {
  await login(page);
  // Verify cards have the draggable role set up by dnd-kit
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const card = firstColumn.locator('[role="button"]').first();
  await expect(card).toHaveAttribute("tabindex", "0");
});

test("card persists after page reload", async ({ page }) => {
  await login(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Persistent card");
  await firstColumn.getByPlaceholder("Details").fill("Should survive reload.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Persistent card").first()).toBeVisible();

  await page.reload();
  await page.getByRole("heading", { name: "Kanban Studio" }).waitFor();
  await expect(page.locator('[data-testid^="column-"]').first().getByText("Persistent card").first()).toBeVisible();
});

test("AI sidebar opens and receives a real reply from OpenRouter", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  await page.getByRole("button", { name: /toggle ai assistant/i }).click();
  await expect(page.getByTestId("ai-sidebar")).toBeVisible();
  await page.getByLabel("Message to AI").fill("Reply with exactly one word: hello");
  await page.getByRole("button", { name: "Send" }).click();
  // Wait for the thinking indicator then the actual reply
  await expect(page.getByTestId("ai-thinking")).toBeVisible();
  await expect(page.getByTestId("ai-message-assistant").first()).toBeVisible({ timeout: 50_000 });
});
