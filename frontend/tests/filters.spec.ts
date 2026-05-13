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

async function addCardWithDetails(page: Page, title: string, details = "") {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(title);
  if (details) await firstColumn.getByPlaceholder("Details").fill(details);
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await firstColumn.getByText(title).first().waitFor();
}

async function openAndSet(page: Page, cardTitle: string, opts: { priority?: "low" | "medium" | "high"; due?: string; labelName?: string }) {
  await page.getByText(cardTitle).first().click();
  await page.getByRole("dialog", { name: /card details/i }).waitFor();
  if (opts.priority) await page.getByRole("radio", { name: new RegExp(`^${opts.priority}$`, "i") }).click();
  if (opts.due) await page.getByLabel(/^due date$/i).fill(opts.due);
  if (opts.labelName) {
    await page.getByRole("button", { name: /manage labels/i }).click();
    const existing = page.getByRole("checkbox", { name: new RegExp(`toggle ${opts.labelName}`, "i") });
    const count = await existing.count();
    if (count > 0) {
      await existing.first().click();
    } else {
      await page.getByRole("button", { name: /new label/i }).click();
      await page.getByPlaceholder("Label name").fill(opts.labelName);
      await page.getByRole("button", { name: /^add$/i }).click();
      await page.waitForTimeout(150);
    }
  }
  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForTimeout(150);
}

test("text search hides non-matching cards", async ({ page }) => {
  await registerAndOpen(page, "f1");
  await addCardWithDetails(page, "Refactor API", "performance work");
  await addCardWithDetails(page, "Design hero", "marketing");
  await addCardWithDetails(page, "Audit invoices", "finance");

  await page.getByLabel("Search cards").fill("invoice");
  await expect(page.getByText("Audit invoices")).toBeVisible();
  await expect(page.getByText("Refactor API")).toHaveCount(0);
  await expect(page.getByText("Design hero")).toHaveCount(0);
  await expect(page.getByTestId("filter-summary")).toHaveText("1 / 3");
});

test("priority pill filters by priority", async ({ page }) => {
  await registerAndOpen(page, "f2");
  await addCardWithDetails(page, "Critical bug");
  await openAndSet(page, "Critical bug", { priority: "high" });
  await addCardWithDetails(page, "Cleanup");
  await openAndSet(page, "Cleanup", { priority: "low" });

  await page.getByRole("checkbox", { name: /filter priority high/i }).click();
  await expect(page.getByText("Critical bug")).toBeVisible();
  await expect(page.getByText("Cleanup")).toHaveCount(0);
});

test("due date 'today' filter shows only today's cards", async ({ page }) => {
  await registerAndOpen(page, "f3");
  // YYYY-MM-DD in local time, matching the filter's local-day comparison
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await addCardWithDetails(page, "Today task");
  await openAndSet(page, "Today task", { due: today });
  await addCardWithDetails(page, "Untimed");

  await page.getByLabel("Due date filter").selectOption("today");
  await expect(page.getByText("Today task")).toBeVisible();
  await expect(page.getByText("Untimed")).toHaveCount(0);
});

test("label filter shows only labeled cards", async ({ page }) => {
  await registerAndOpen(page, "f4");
  await addCardWithDetails(page, "Engineering work");
  await openAndSet(page, "Engineering work", { labelName: "Eng" });
  await addCardWithDetails(page, "Marketing work");

  await page.getByRole("button", { name: /labels filter/i }).click();
  await page.getByRole("checkbox", { name: /filter by eng/i }).click();
  await expect(page.getByText("Engineering work")).toBeVisible();
  await expect(page.getByText("Marketing work")).toHaveCount(0);
});

test("clear button restores all cards", async ({ page }) => {
  await registerAndOpen(page, "f5");
  await addCardWithDetails(page, "Keepable");
  await addCardWithDetails(page, "Other");
  await page.getByLabel("Search cards").fill("Keep");
  await expect(page.getByText("Other")).toHaveCount(0);
  await page.getByRole("button", { name: /^clear \(/i }).click();
  await expect(page.getByText("Other")).toBeVisible();
  await expect(page.getByText("Keepable")).toBeVisible();
});

test("switching boards resets filter", async ({ page }) => {
  await registerAndOpen(page, "f6");
  await addCardWithDetails(page, "BoardA card");
  await page.getByLabel("Search cards").fill("nope");
  await expect(page.getByText("BoardA card")).toHaveCount(0);

  await page.getByRole("button", { name: /switch board/i }).click();
  await page.getByRole("button", { name: /new board/i }).click();
  await page.getByPlaceholder("Board name").fill("Second");
  await page.getByRole("button", { name: /^add$/i }).click();

  // Filter is cleared on board switch
  await expect(page.getByLabel("Search cards")).toHaveValue("");
});
