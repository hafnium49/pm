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

test("post a comment, see it in the modal and a count on the card", async ({ page }) => {
  await registerAndOpen(page, "cm1");
  await addCard(page, "Big feature");

  await page.getByText("Big feature").first().click();
  await page.getByRole("dialog", { name: /card details/i }).waitFor();

  // No comments yet
  await expect(page.getByText(/no comments yet/i)).toBeVisible();

  await page.getByLabel("New comment").fill("First impressions: solid.");
  await page.getByRole("button", { name: /^comment$/i }).click();

  await expect(page.getByText("First impressions: solid.")).toBeVisible();

  await page.keyboard.press("Escape");
  // Comment count chip should now be visible on the card
  await expect(page.getByTestId("comment-count")).toContainText("1");
});

test("posts multiple comments preserving order", async ({ page }) => {
  await registerAndOpen(page, "cm2");
  await addCard(page, "Multi");
  await page.getByText("Multi").first().click();
  await page.getByRole("dialog", { name: /card details/i }).waitFor();
  const textarea = page.getByLabel("New comment");
  const submitBtn = page.getByRole("button", { name: /^comment$/i });
  for (const text of ["first", "second", "third"]) {
    await expect(submitBtn).toBeDisabled();
    await textarea.fill(text);
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  // Reload and verify order persists
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByText("Multi").first().click();
  await page.getByRole("dialog", { name: /card details/i }).waitFor();
  const items = await page.locator('[data-testid^="comment-"] p').allTextContents();
  expect(items).toEqual(["first", "second", "third"]);
});

test("delete own comment removes it and decrements the count", async ({ page }) => {
  await registerAndOpen(page, "cm3");
  await addCard(page, "DeleteMe");
  await page.getByText("DeleteMe").first().click();
  await page.getByRole("dialog", { name: /card details/i }).waitFor();
  await page.getByLabel("New comment").fill("temporary");
  await page.getByRole("button", { name: /^comment$/i }).click();
  await expect(page.getByText("temporary")).toBeVisible();

  const commentItem = page.locator('[data-testid^="comment-"]').filter({ hasText: "temporary" });
  await commentItem.hover();
  await commentItem.getByRole("button", { name: /delete comment/i }).click();
  await expect(page.getByText("temporary")).toHaveCount(0);
  await expect(page.getByText(/no comments yet/i)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("comment-count")).toHaveCount(0);
});

test("empty comment text doesn't submit", async ({ page }) => {
  await registerAndOpen(page, "cm4");
  await addCard(page, "Empty");
  await page.getByText("Empty").first().click();
  await page.getByRole("dialog", { name: /card details/i }).waitFor();
  // Button is disabled when textarea is empty
  await expect(page.getByRole("button", { name: /^comment$/i })).toBeDisabled();
  await page.getByLabel("New comment").fill("   ");
  await expect(page.getByRole("button", { name: /^comment$/i })).toBeDisabled();
});

test("comments do not leak across cards", async ({ page }) => {
  await registerAndOpen(page, "cm5");
  await addCard(page, "First card");
  await addCard(page, "Second card");

  await page.getByText("First card").first().click();
  await page.getByRole("dialog", { name: /card details/i }).waitFor();
  await page.getByLabel("New comment").fill("on the first");
  await page.getByRole("button", { name: /^comment$/i }).click();
  await expect(page.getByText("on the first")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByText("Second card").first().click();
  await page.getByRole("dialog", { name: /card details/i }).waitFor();
  await expect(page.getByText(/no comments yet/i)).toBeVisible();
  await expect(page.getByText("on the first")).toHaveCount(0);
});
