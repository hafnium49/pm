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

test("create a new board, switch to it, and see five fresh columns", async ({ page }) => {
  await registerAndOpen(page, uniqueUsername("nb"));
  await page.getByRole("button", { name: /switch board/i }).click();
  await page.getByRole("button", { name: /new board/i }).click();
  await page.getByPlaceholder("Board name").fill("Project Phoenix");
  await page.getByRole("button", { name: /^add$/i }).click();
  // Switcher now shows the new board
  await expect(page.getByRole("button", { name: /switch board/i })).toContainText("Project Phoenix");
  // Five empty columns
  const cols = page.locator('[data-testid^="column-"]');
  await expect(cols).toHaveCount(5);
  for (let i = 0; i < 5; i++) {
    await expect(cols.nth(i).getByText(/drop a card here/i)).toBeVisible();
  }
});

test("cards stay on their own board when switching", async ({ page }) => {
  await registerAndOpen(page, uniqueUsername("sw"));

  // Add a card to the default board
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Default board card");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Default board card")).toBeVisible();

  // Create another board
  await page.getByRole("button", { name: /switch board/i }).click();
  await page.getByRole("button", { name: /new board/i }).click();
  await page.getByPlaceholder("Board name").fill("Second");
  await page.getByRole("button", { name: /^add$/i }).click();

  // The new board should not show the first card
  await expect(page.getByText("Default board card")).toHaveCount(0);

  // Switch back via the switcher; the card is there again
  await page.getByRole("button", { name: /switch board/i }).click();
  const listbox = page.getByRole("listbox");
  await listbox.getByRole("option", { name: /My Board/ }).click();
  await expect(page.getByText("Default board card")).toBeVisible();
});

test("rename a board from the switcher", async ({ page }) => {
  await registerAndOpen(page, uniqueUsername("rn"));
  await page.getByRole("button", { name: /switch board/i }).click();
  await page.getByRole("button", { name: /rename my board/i }).click();
  await page.getByPlaceholder("Board name").fill("Renamed Board");
  await page.getByRole("button", { name: /save name/i }).click();
  // Trigger button reflects new name
  await page.getByRole("button", { name: /switch board/i }).click();
  await expect(page.getByRole("button", { name: /switch board/i })).toContainText("Renamed Board");
});

test("delete is blocked when only one board remains", async ({ page }) => {
  await registerAndOpen(page, uniqueUsername("del"));
  await page.getByRole("button", { name: /switch board/i }).click();
  // Delete button exists but is disabled when only one board
  const deleteBtn = page.getByRole("button", { name: /delete my board/i });
  await expect(deleteBtn).toBeDisabled();
});

test("delete a non-default board works and switches back", async ({ page }) => {
  await registerAndOpen(page, uniqueUsername("del2"));
  // Create a second board, then delete it
  await page.getByRole("button", { name: /switch board/i }).click();
  await page.getByRole("button", { name: /new board/i }).click();
  await page.getByPlaceholder("Board name").fill("Temp");
  await page.getByRole("button", { name: /^add$/i }).click();
  await expect(page.getByRole("button", { name: /switch board/i })).toContainText("Temp");

  // Accept the confirm() dialog and delete
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /switch board/i }).click();
  await page.getByRole("button", { name: /delete temp/i }).click();
  // We were on Temp; should switch to the remaining board (My Board)
  await expect(page.getByRole("button", { name: /switch board/i })).toContainText("My Board");
});

test("two users see independent boards", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  const aliceName = uniqueUsername("alice");
  const bobName = uniqueUsername("bob");
  await registerAndOpen(pageA, aliceName);
  await registerAndOpen(pageB, bobName);

  // Alice creates a board
  await pageA.getByRole("button", { name: /switch board/i }).click();
  await pageA.getByRole("button", { name: /new board/i }).click();
  await pageA.getByPlaceholder("Board name").fill("Alice Private");
  await pageA.getByRole("button", { name: /^add$/i }).click();
  await expect(pageA.getByRole("button", { name: /switch board/i })).toContainText("Alice Private");

  // Bob does not see Alice's board
  await pageB.getByRole("button", { name: /switch board/i }).click();
  await expect(pageB.getByRole("listbox").getByText("Alice Private")).toHaveCount(0);

  await ctxA.close();
  await ctxB.close();
});

test("legacy login still works for the seeded user", async ({ page }) => {
  await page.goto("/login/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.getByRole("heading", { name: "Kanban Studio" }).waitFor();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});
