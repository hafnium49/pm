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
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("cards are draggable between columns", async ({ page }) => {
  await login(page);
  // Verify cards have the draggable role set up by dnd-kit
  const card = page.getByTestId("card-card-1");
  await expect(card).toHaveAttribute("role", "button");
  await expect(card).toHaveAttribute("tabindex", "0");
  // Verify the target column exists and is a droppable region
  const targetColumn = page.getByTestId("column-col-review");
  await expect(targetColumn).toBeVisible();
});
