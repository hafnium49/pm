import { expect, test, type Browser, type Page } from "@playwright/test";

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

async function loginAs(page: Page, username: string) {
  await page.goto("/login/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("supersecret");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.getByRole("heading", { name: "Kanban Studio" }).waitFor();
}

async function setupPair(browser: Browser) {
  const ownerName = uniqueUsername("owner");
  const friendName = uniqueUsername("friend");
  // Register both users via fresh contexts
  const ownerCtx = await browser.newContext();
  const friendCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  const friend = await friendCtx.newPage();
  await registerAndOpen(owner, ownerName);
  await registerAndOpen(friend, friendName);
  return { ownerCtx, friendCtx, owner, friend, ownerName, friendName };
}

test("owner invites a friend as editor and sees them in the members list", async ({ browser }) => {
  const { ownerCtx, friendCtx, owner, friendName } = await setupPair(browser);
  try {
    await owner.getByRole("button", { name: /open members/i }).click();
    await expect(owner.getByRole("dialog", { name: /board members/i })).toBeVisible();
    await owner.getByLabel("Member username").fill(friendName);
    await owner.getByLabel("Invite role").selectOption("editor");
    await owner.getByRole("button", { name: /^invite$/i }).click();
    // Member entry appears
    const memberRow = owner.locator('[data-testid^="member-"]').filter({ hasText: friendName });
    await expect(memberRow).toBeVisible();
    await expect(memberRow).toContainText(/editor/i);
  } finally {
    await ownerCtx.close();
    await friendCtx.close();
  }
});

test("editor sees the shared board and can add a card", async ({ browser }) => {
  const { ownerCtx, friendCtx, owner, friend, friendName } = await setupPair(browser);
  try {
    // Owner invites friend as editor
    await owner.getByRole("button", { name: /open members/i }).click();
    await owner.getByLabel("Member username").fill(friendName);
    await owner.getByLabel("Invite role").selectOption("editor");
    await owner.getByRole("button", { name: /^invite$/i }).click();
    await owner.keyboard.press("Escape");

    // Friend opens the board switcher — the owner's board appears
    await friend.reload();
    await friend.getByRole("heading", { name: "Kanban Studio" }).waitFor();
    await friend.getByRole("button", { name: /switch board/i }).click();
    // Two My Board entries (their own + the shared one). Click whichever isn't already current.
    const listbox = friend.getByRole("listbox");
    const items = listbox.getByRole("option", { name: /My Board/i });
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(2);
    // Click the 2nd one (the shared)
    await items.nth(1).click();

    // Editor can add a card
    const firstColumn = friend.locator('[data-testid^="column-"]').first();
    await firstColumn.getByRole("button", { name: /add a card/i }).click();
    await firstColumn.getByPlaceholder("Card title").fill("from editor");
    await firstColumn.getByRole("button", { name: /add card/i }).click();
    await expect(firstColumn.getByText("from editor")).toBeVisible();
  } finally {
    await ownerCtx.close();
    await friendCtx.close();
  }
});

test("viewer cannot edit — write affordances are hidden", async ({ browser }) => {
  const { ownerCtx, friendCtx, owner, friend, friendName } = await setupPair(browser);
  try {
    // Owner adds a card so the friend has something to see
    const firstColumn = owner.locator('[data-testid^="column-"]').first();
    await firstColumn.getByRole("button", { name: /add a card/i }).click();
    await firstColumn.getByPlaceholder("Card title").fill("read-only card");
    await firstColumn.getByRole("button", { name: /add card/i }).click();
    await expect(firstColumn.getByText("read-only card")).toBeVisible();

    // Invite friend as viewer
    await owner.getByRole("button", { name: /open members/i }).click();
    await owner.getByLabel("Member username").fill(friendName);
    await owner.getByLabel("Invite role").selectOption("viewer");
    await owner.getByRole("button", { name: /^invite$/i }).click();
    await owner.keyboard.press("Escape");

    // Friend switches to the shared board
    await friend.reload();
    await friend.getByRole("heading", { name: "Kanban Studio" }).waitFor();
    await friend.getByRole("button", { name: /switch board/i }).click();
    const items = friend.getByRole("listbox").getByRole("option", { name: /My Board/i });
    await items.nth(1).click();

    // Friend sees the card
    await expect(friend.getByText("read-only card")).toBeVisible();
    // But the New column tile and Add a card buttons are gone
    await expect(friend.getByTestId("add-column-button")).toHaveCount(0);
    await expect(friend.getByRole("button", { name: /add a card/i })).toHaveCount(0);
  } finally {
    await ownerCtx.close();
    await friendCtx.close();
  }
});

test("change role from viewer to editor unlocks editing", async ({ browser }) => {
  const { ownerCtx, friendCtx, owner, friend, friendName } = await setupPair(browser);
  try {
    // Invite as viewer
    await owner.getByRole("button", { name: /open members/i }).click();
    await owner.getByLabel("Member username").fill(friendName);
    await owner.getByLabel("Invite role").selectOption("viewer");
    await owner.getByRole("button", { name: /^invite$/i }).click();
    // Promote to editor via the row's role select
    const friendRow = owner.locator('[data-testid^="member-"]').filter({ hasText: friendName });
    await friendRow.getByRole("combobox", { name: new RegExp(`Role for ${friendName}`, "i") }).selectOption("editor");
    await owner.keyboard.press("Escape");

    // Friend reloads and now has editor affordances
    await friend.reload();
    await friend.getByRole("heading", { name: "Kanban Studio" }).waitFor();
    await friend.getByRole("button", { name: /switch board/i }).click();
    const items = friend.getByRole("listbox").getByRole("option", { name: /My Board/i });
    await items.nth(1).click();

    // Now Add card is visible
    await expect(friend.locator('[data-testid^="column-"]').first().getByRole("button", { name: /add a card/i })).toBeVisible();
  } finally {
    await ownerCtx.close();
    await friendCtx.close();
  }
});

test("member can leave a board they were invited to", async ({ browser }) => {
  const { ownerCtx, friendCtx, owner, friend, friendName } = await setupPair(browser);
  try {
    // Invite as editor
    await owner.getByRole("button", { name: /open members/i }).click();
    await owner.getByLabel("Member username").fill(friendName);
    await owner.getByRole("button", { name: /^invite$/i }).click();
    await owner.keyboard.press("Escape");

    // Friend switches to the shared board and leaves it
    await friend.reload();
    await friend.getByRole("heading", { name: "Kanban Studio" }).waitFor();
    await friend.getByRole("button", { name: /switch board/i }).click();
    const items = friend.getByRole("listbox").getByRole("option", { name: /My Board/i });
    await items.nth(1).click();

    friend.once("dialog", (d) => d.accept());
    await friend.getByRole("button", { name: /open members/i }).click();
    await friend.getByRole("button", { name: /leave board/i }).click();

    // Friend now only sees their own board
    await friend.waitForTimeout(300);
    await friend.getByRole("button", { name: /switch board/i }).click();
    const itemsAfter = friend.getByRole("listbox").getByRole("option", { name: /My Board/i });
    await expect(itemsAfter).toHaveCount(1);
  } finally {
    await ownerCtx.close();
    await friendCtx.close();
  }
});

test("non-owner cannot see the invite form", async ({ browser }) => {
  const { ownerCtx, friendCtx, owner, friend, friendName } = await setupPair(browser);
  try {
    await owner.getByRole("button", { name: /open members/i }).click();
    await owner.getByLabel("Member username").fill(friendName);
    await owner.getByRole("button", { name: /^invite$/i }).click();
    await owner.keyboard.press("Escape");

    await friend.reload();
    await friend.getByRole("heading", { name: "Kanban Studio" }).waitFor();
    await friend.getByRole("button", { name: /switch board/i }).click();
    const items = friend.getByRole("listbox").getByRole("option", { name: /My Board/i });
    await items.nth(1).click();

    await friend.getByRole("button", { name: /open members/i }).click();
    await expect(friend.getByRole("dialog", { name: /board members/i })).toBeVisible();
    // Invite form not present for non-owners
    await expect(friend.getByLabel("Member username")).toHaveCount(0);
  } finally {
    await ownerCtx.close();
    await friendCtx.close();
  }
});

test("invite unknown username surfaces an error", async ({ browser }) => {
  const { ownerCtx, friendCtx, owner } = await setupPair(browser);
  try {
    await owner.getByRole("button", { name: /open members/i }).click();
    await owner.getByLabel("Member username").fill("no-such-user-1234567");
    await owner.getByRole("button", { name: /^invite$/i }).click();
    await expect(owner.getByTestId("invite-error")).toContainText(/no such user/i);
  } finally {
    await ownerCtx.close();
    await friendCtx.close();
  }
});
