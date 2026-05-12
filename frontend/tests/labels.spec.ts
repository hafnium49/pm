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

test("create a label from inside the modal and attach it to a card", async ({ page }) => {
  await registerAndOpen(page, "lbl1");
  await addCard(page, "Refactor API");
  await page.getByText("Refactor API").first().click();
  await page.getByRole("dialog", { name: /card details/i }).waitFor();
  await page.getByRole("button", { name: /manage labels/i }).click();

  await page.getByRole("button", { name: /new label/i }).click();
  await page.getByPlaceholder("Label name").fill("Bug");
  await page.getByRole("radio", { name: /color red/i }).click();
  await page.getByRole("button", { name: /^add$/i }).click();

  // Label appears in the modal's labels list section
  await expect(page.getByTestId(/modal-label-/)).toContainText("Bug");

  // Close modal, label chip appears on the card
  await page.keyboard.press("Escape");
  await expect(page.getByTestId(/card-label-/)).toContainText("Bug");
});

test("toggling an existing label on and off updates the card chips", async ({ page }) => {
  await registerAndOpen(page, "lbl2");
  await addCard(page, "Triage");
  // Open card and create a label
  await page.getByText("Triage").first().click();
  await page.getByRole("button", { name: /manage labels/i }).click();
  await page.getByRole("button", { name: /new label/i }).click();
  await page.getByPlaceholder("Label name").fill("Feature");
  await page.getByRole("button", { name: /^add$/i }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId(/card-label-/)).toContainText("Feature");

  // Re-open, toggle off
  await page.getByText("Triage").first().click();
  await page.getByRole("button", { name: /manage labels/i }).click();
  await page.getByRole("checkbox", { name: /toggle feature/i }).click();
  await expect(page.getByTestId(/modal-label-/)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId(/card-label-/)).toHaveCount(0);
});

test("renaming a label updates the chip on the card", async ({ page }) => {
  await registerAndOpen(page, "lbl3");
  await addCard(page, "Doc");

  // Open card, create + attach label
  await page.getByText("Doc").first().click();
  await page.getByRole("button", { name: /manage labels/i }).click();
  await page.getByRole("button", { name: /new label/i }).click();
  await page.getByPlaceholder("Label name").fill("Docs");
  await page.getByRole("button", { name: /^add$/i }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId(/card-label-/)).toContainText("Docs");

  // Re-open, rename it
  await page.getByText("Doc").first().click();
  await page.getByRole("button", { name: /manage labels/i }).click();
  // Reveal pencil button on the row
  await page.getByRole("checkbox", { name: /toggle docs/i }).hover();
  await page.getByRole("button", { name: /rename docs/i }).click();
  // First input in the picker dialog is the rename input
  await page.getByRole("dialog", { name: /label picker/i }).getByRole("textbox").first().fill("Writing");
  await page.getByRole("button", { name: /save label/i }).click();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId(/card-label-/)).toContainText("Writing");
});

test("deleting a label removes it from the card", async ({ page }) => {
  await registerAndOpen(page, "lbl4");
  await addCard(page, "DelLabel");
  await page.getByText("DelLabel").first().click();
  await page.getByRole("button", { name: /manage labels/i }).click();
  await page.getByRole("button", { name: /new label/i }).click();
  await page.getByPlaceholder("Label name").fill("Junk");
  await page.getByRole("button", { name: /^add$/i }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId(/card-label-/)).toContainText("Junk");

  page.once("dialog", (d) => d.accept());
  await page.getByText("DelLabel").first().click();
  await page.getByRole("button", { name: /manage labels/i }).click();
  await page.getByRole("checkbox", { name: /toggle junk/i }).hover();
  await page.getByRole("button", { name: /delete junk/i }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId(/card-label-/)).toHaveCount(0);
});

test("labels created on one board don't appear on another", async ({ page }) => {
  await registerAndOpen(page, "lbl5");
  await addCard(page, "OnBoardA");
  await page.getByText("OnBoardA").first().click();
  await page.getByRole("button", { name: /manage labels/i }).click();
  await page.getByRole("button", { name: /new label/i }).click();
  await page.getByPlaceholder("Label name").fill("OnlyA");
  await page.getByRole("button", { name: /^add$/i }).click();
  await page.keyboard.press("Escape");

  // Switch to a new board
  await page.getByRole("button", { name: /switch board/i }).click();
  await page.getByRole("button", { name: /new board/i }).click();
  await page.getByPlaceholder("Board name").fill("Second");
  await page.getByRole("button", { name: /^add$/i }).click();

  // Add a card and open its modal
  await addCard(page, "OnBoardB");
  await page.getByText("OnBoardB").first().click();
  await page.getByRole("button", { name: /manage labels/i }).click();

  // Picker shows no labels (board B is empty); creating same name is OK
  await expect(page.getByText(/no labels yet/i)).toBeVisible();
});
