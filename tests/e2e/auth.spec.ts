import { expect, test } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { createConfirmedUser, deleteUser, type TestUser } from "./helpers/users";

test("AC-1: a signed-out visitor is redirected to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Mordomia" })).toBeVisible();
});

test("AC-2: sign-up rejects an invalid username", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Sign up" }).click();
  await page.getByLabel("Username", { exact: true }).fill("a!");
  await page.getByLabel("Email", { exact: true }).fill("invalid-username@example.test");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText("Username must be 3–24 characters: letters, numbers or _."),
  ).toBeVisible();
});

test.describe("with a confirmed user", () => {
  let user: TestUser;

  test.beforeEach(async () => {
    user = await createConfirmedUser();
  });

  test.afterEach(async () => {
    await deleteUser(user.id);
  });

  test("AC-4, AC-5: sign in shows @username in the account menu, sign out returns to /login", async ({
    page,
  }) => {
    await signIn(page, user);
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByRole("menu")).toContainText(`@${user.username}`);

    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // The session is gone: the home page redirects again.
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});
