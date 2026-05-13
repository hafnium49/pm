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

async function addCard(page: Page, title: string) {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(title);
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await firstColumn.getByText(title).first().waitFor();
}

test("delete a card sends it to the archive (recoverable)", async ({ page }) => {
  await registerAndOpen(page, "arc1");
  await addCard(page, "Recoverable");
  // Delete via the modal's Delete button to also exercise it
  await page.getByText("Recoverable").first().click();
  await page.getByRole("dialog", { name: /card details/i }).waitFor();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /^delete$/i }).click();
  await expect(page.getByText("Recoverable")).toHaveCount(0);

  // Open the archive — card is there
  await page.getByRole("button", { name: /open archive/i }).click();
  await expect(page.getByRole("dialog", { name: /archived cards/i })).toBeVisible();
  await expect(page.getByText("Recoverable")).toBeVisible();
});

test("restore an archived card brings it back to the board", async ({ page }) => {
  await registerAndOpen(page, "arc2");
  await addCard(page, "Bring me back");
  // Quick archive via inline trash on the card (no confirm prompt on the inline button)
  const card = page.locator('[data-testid^="card-"]').filter({ hasText: "Bring me back" });
  await card.hover();
  await card.getByRole("button", { name: /delete bring me back/i }).click();
  await expect(page.getByText("Bring me back")).toHaveCount(0);

  await page.getByRole("button", { name: /open archive/i }).click();
  await page.getByRole("button", { name: /restore bring me back/i }).click();
  // Modal entry is gone
  await expect(page.locator('[data-testid^="archived-card-"]')).toHaveCount(0);

  // Close the archive — card is back on the board
  await page.keyboard.press("Escape");
  await expect(page.getByText("Bring me back")).toBeVisible();
});

test("permanently delete from archive removes the card forever", async ({ page }) => {
  await registerAndOpen(page, "arc3");
  await addCard(page, "Goodbye forever");
  const card = page.locator('[data-testid^="card-"]').filter({ hasText: "Goodbye forever" });
  await card.hover();
  await card.getByRole("button", { name: /delete goodbye forever/i }).click();
  await expect(page.getByText("Goodbye forever")).toHaveCount(0);

  await page.getByRole("button", { name: /open archive/i }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /permanently delete goodbye forever/i }).click();
  await expect(page.locator('[data-testid^="archived-card-"]')).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Reopen — empty
  await page.getByRole("button", { name: /open archive/i }).click();
  await expect(page.getByText(/no archived cards/i)).toBeVisible();
});

test("archive shows the empty state when nothing has been archived", async ({ page }) => {
  await registerAndOpen(page, "arc4");
  await page.getByRole("button", { name: /open archive/i }).click();
  await expect(page.getByText(/no archived cards/i)).toBeVisible();
});

test("archive is scoped to the current board", async ({ page }) => {
  await registerAndOpen(page, "arc5");
  await addCard(page, "On board A");
  const card = page.locator('[data-testid^="card-"]').filter({ hasText: "On board A" });
  await card.hover();
  await card.getByRole("button", { name: /delete on board a/i }).click();

  // Create + switch to a second board
  await page.getByRole("button", { name: /switch board/i }).click();
  await page.getByRole("button", { name: /new board/i }).click();
  await page.getByPlaceholder("Board name").fill("Other");
  await page.getByRole("button", { name: /^add$/i }).click();

  // The other board's archive is empty
  await page.getByRole("button", { name: /open archive/i }).click();
  await expect(page.getByText(/no archived cards/i)).toBeVisible();
});
