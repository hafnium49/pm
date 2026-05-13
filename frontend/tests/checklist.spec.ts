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

async function addCardAndOpenModal(page: Page, title: string) {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(title);
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await firstColumn.getByText(title).first().waitFor();
  await page.getByText(title).first().click();
  await page.getByRole("dialog", { name: /card details/i }).waitFor();
}

test("add a subtask and see it in the modal", async ({ page }) => {
  await registerAndOpen(page, "chk1");
  await addCardAndOpenModal(page, "Plan release");
  await page.getByLabel("New checklist item").fill("Write tests");
  await page.getByRole("button", { name: /add subtask/i }).click();
  await expect(page.getByText("Write tests")).toBeVisible();
});

test("checklist progress count appears on the card after closing the modal", async ({ page }) => {
  await registerAndOpen(page, "chk2");
  await addCardAndOpenModal(page, "Has subtasks");
  const input = page.getByLabel("New checklist item");
  await input.fill("First step");
  await input.press("Enter");
  await expect(page.getByText("First step")).toBeVisible();
  await input.fill("Second step");
  await input.press("Enter");
  await expect(page.getByText("Second step")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("checklist-count")).toContainText("0/2");
});

test("toggling subtasks updates the count chip", async ({ page }) => {
  await registerAndOpen(page, "chk3");
  await addCardAndOpenModal(page, "Toggle me");
  const input = page.getByLabel("New checklist item");
  await input.fill("alpha");
  await input.press("Enter");
  await expect(page.getByText("alpha")).toBeVisible();
  await input.fill("beta");
  await input.press("Enter");
  await expect(page.getByText("beta")).toBeVisible();

  await page.getByRole("checkbox", { name: /toggle alpha/i }).click();
  await expect(page.getByTestId("checklist-progress")).toContainText("1 / 2");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("checklist-count")).toContainText("1/2");
});

test("renaming a subtask persists across reopen", async ({ page }) => {
  await registerAndOpen(page, "chk4");
  await addCardAndOpenModal(page, "Rename target");
  await page.getByLabel("New checklist item").fill("orig text");
  await page.getByRole("button", { name: /add subtask/i }).click();
  const row = page.locator('[data-testid^="checklist-item-"]');
  await row.hover();
  await row.getByRole("button", { name: /edit orig text/i }).click();
  const input = row.getByRole("textbox");
  await input.fill("updated");
  await input.press("Enter");
  await expect(page.getByText("updated")).toBeVisible();

  await page.keyboard.press("Escape");
  await page.getByText("Rename target").first().click();
  await expect(page.getByText("updated")).toBeVisible();
});

test("deleting a subtask removes it and decrements the count", async ({ page }) => {
  await registerAndOpen(page, "chk5");
  await addCardAndOpenModal(page, "Delete sub");
  await page.getByLabel("New checklist item").fill("trash me");
  await page.getByRole("button", { name: /add subtask/i }).click();

  const row = page.locator('[data-testid^="checklist-item-"]').filter({ hasText: "trash me" });
  await row.hover();
  await row.getByRole("button", { name: /delete trash me/i }).click();
  await expect(page.getByText("trash me")).toHaveCount(0);

  await page.keyboard.press("Escape");
  // No progress chip if no subtasks
  await expect(page.getByTestId("checklist-count")).toHaveCount(0);
});

test("checklist completion turns the chip green", async ({ page }) => {
  await registerAndOpen(page, "chk6");
  await addCardAndOpenModal(page, "Done card");
  await page.getByLabel("New checklist item").fill("only");
  await page.getByRole("button", { name: /add subtask/i }).click();
  await page.getByRole("checkbox", { name: /toggle only/i }).click();
  await page.keyboard.press("Escape");
  const chip = page.getByTestId("checklist-count");
  await expect(chip).toContainText("1/1");
  await expect(chip).toHaveClass(/text-emerald-700/);
});
