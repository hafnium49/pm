import { expect, test, type Page } from "@playwright/test";

function uniqueUsername(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

async function registerAndOpen(page: Page, prefix: string) {
  await page.goto("/register/");
  await page.getByLabel("Username").fill(uniqueUsername(prefix));
  await page.getByLabel("Password", { exact: true }).fill("supersecret");
  await page.getByLabel("Confirm password").fill("supersecret");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.getByRole("heading", { name: "Kanban Studio" }).waitFor();
}

test("default board starts with 5 columns; add a 6th", async ({ page }) => {
  await registerAndOpen(page, "col1");
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);

  await page.getByTestId("add-column-button").click();
  await page.getByLabel(/column name/i).fill("Blocked");
  await page.getByRole("button", { name: /^add$/i }).click();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(6);
  // New column's title is in an editable input
  await expect(page.locator('input[aria-label="Column title"][value="Blocked"]')).toBeVisible();
});

test("delete a column removes it and its cards", async ({ page }) => {
  await registerAndOpen(page, "col2");
  // Add a card to Backlog
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Goes away");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Goes away")).toBeVisible();

  // Delete Backlog
  page.once("dialog", (d) => d.accept());
  await firstColumn.hover();
  await firstColumn.getByRole("button", { name: /delete column backlog/i }).click();

  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(4);
  await expect(page.getByText("Goes away")).toHaveCount(0);
});

test("cannot delete the last remaining column", async ({ page }) => {
  await registerAndOpen(page, "col3");
  // Delete columns until 1 remains
  for (let i = 0; i < 4; i++) {
    page.once("dialog", (d) => d.accept());
    const col = page.locator('[data-testid^="column-"]').last();
    await col.hover();
    await col.getByRole("button", { name: /delete column/i }).click();
    await page.waitForTimeout(150);
  }
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(1);

  // The remaining delete button is disabled
  const onlyCol = page.locator('[data-testid^="column-"]').first();
  await onlyCol.hover();
  await expect(onlyCol.getByRole("button", { name: /delete column/i })).toBeDisabled();
});

test("new column persists after reload", async ({ page }) => {
  await registerAndOpen(page, "col4");
  await page.getByTestId("add-column-button").click();
  await page.getByLabel(/column name/i).fill("On Hold");
  await page.getByRole("button", { name: /^add$/i }).click();
  await expect(page.locator('input[aria-label="Column title"][value="On Hold"]')).toBeVisible();

  await page.reload();
  await page.getByRole("heading", { name: "Kanban Studio" }).waitFor();
  await expect(page.locator('input[aria-label="Column title"][value="On Hold"]')).toBeVisible();
});

test("add column via Enter key", async ({ page }) => {
  await registerAndOpen(page, "col5");
  await page.getByTestId("add-column-button").click();
  const input = page.getByLabel(/column name/i);
  await input.fill("Quick");
  await input.press("Enter");
  await expect(page.locator('input[aria-label="Column title"][value="Quick"]')).toBeVisible();
});

test("Escape closes the add-column form", async ({ page }) => {
  await registerAndOpen(page, "col6");
  await page.getByTestId("add-column-button").click();
  await expect(page.getByTestId("add-column-form")).toBeVisible();
  await page.getByLabel(/column name/i).press("Escape");
  await expect(page.getByTestId("add-column-form")).toHaveCount(0);
  await expect(page.getByTestId("add-column-button")).toBeVisible();
});
