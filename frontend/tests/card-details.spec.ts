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

async function addCard(page: Page, title: string, details = "") {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(title);
  if (details) await firstColumn.getByPlaceholder("Details").fill(details);
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await firstColumn.getByText(title).first().waitFor();
}

test("click a card opens the detail modal", async ({ page }) => {
  await registerAndOpen(page, "cd1");
  await addCard(page, "Plan Q4", "Outline themes and outcomes.");
  await page.getByText("Plan Q4").first().click();
  await expect(page.getByRole("dialog", { name: /card details/i })).toBeVisible();
  await expect(page.getByLabel(/^title$/i)).toHaveValue("Plan Q4");
  await expect(page.getByLabel(/description/i)).toHaveValue("Outline themes and outcomes.");
});

test("edit title, details, priority, and due date; values persist after reload", async ({ page }) => {
  await registerAndOpen(page, "cd2");
  await addCard(page, "Spike investigation");
  await page.getByText("Spike investigation").first().click();
  const dialog = page.getByRole("dialog");

  await dialog.getByLabel(/^title$/i).fill("Spike investigation v2");
  await dialog.getByLabel(/description/i).fill("Time-box to 2 days.");
  await dialog.getByRole("radio", { name: /high/i }).click();
  await dialog.getByLabel(/^due date$/i).fill("2027-01-15");
  await dialog.getByRole("button", { name: /^save$/i }).click();
  await expect(dialog).toBeHidden();

  // Card now reflects the new title + a due date chip
  await expect(page.getByText("Spike investigation v2")).toBeVisible();
  await expect(page.getByText(/Jan 15/i)).toBeVisible();

  // Reload and re-open the modal — fields persist
  await page.reload();
  await page.getByText("Spike investigation v2").first().click();
  await expect(page.getByLabel(/^title$/i)).toHaveValue("Spike investigation v2");
  await expect(page.getByLabel(/description/i)).toHaveValue("Time-box to 2 days.");
  await expect(page.getByRole("radio", { name: /high/i })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel(/^due date$/i)).toHaveValue("2027-01-15");
});

test("clearing the due date removes the chip", async ({ page }) => {
  await registerAndOpen(page, "cd3");
  await addCard(page, "Dated");
  await page.getByText("Dated").first().click();
  await page.getByLabel(/^due date$/i).fill("2027-06-01");
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByText(/Jun 1/i)).toBeVisible();

  await page.getByText("Dated").first().click();
  await page.getByRole("button", { name: /clear due date/i }).click();
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByText(/Jun 1/i)).toHaveCount(0);
});

test("escape closes the modal without saving", async ({ page }) => {
  await registerAndOpen(page, "cd4");
  await addCard(page, "Untouched", "original");
  await page.getByText("Untouched").first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/description/i).fill("garbage I don't want");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // Reopen — original details are still there
  await page.getByText("Untouched").first().click();
  await expect(page.getByLabel(/description/i)).toHaveValue("original");
});

test("delete inside modal removes the card", async ({ page }) => {
  await registerAndOpen(page, "cd5");
  await addCard(page, "DeleteMe");
  page.once("dialog", (d) => d.accept());
  await page.getByText("DeleteMe").first().click();
  await page.getByRole("button", { name: /^delete$/i }).click();
  await expect(page.getByText("DeleteMe")).toHaveCount(0);
});

test("clicking the inline trash icon still works (does not open the modal)", async ({ page }) => {
  await registerAndOpen(page, "cd6");
  await addCard(page, "QuickKill");
  page.once("dialog", (d) => d.accept());
  const card = page.locator('[data-testid^="card-"]').filter({ hasText: "QuickKill" });
  await card.hover();
  await card.getByRole("button", { name: /delete quickkill/i }).click();
  await expect(page.getByText("QuickKill")).toHaveCount(0);
  // Modal did not open
  await expect(page.getByRole("dialog", { name: /card details/i })).toHaveCount(0);
});
