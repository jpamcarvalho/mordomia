import { expect, test, type Page } from "@playwright/test";
import { createConfirmedUser, deleteUser, type TestUser } from "./helpers/users";

async function signIn(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(user.email);
  await page.getByPlaceholder("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("AC-1: a signed-out visitor is redirected to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Mordomia" })).toBeVisible();
});

test("AC-2: sign-up rejects an invalid username", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "No account? Sign up" }).click();
  await page.getByPlaceholder("Username").fill("a!");
  await page.getByPlaceholder("Email").fill("invalid-username@example.test");
  await page.getByPlaceholder("Password").fill("password123");
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

  test("AC-4, AC-5: sign in greets by @username, sign out returns to /login", async ({ page }) => {
    await signIn(page, user);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(`Hi @${user.username} 👋`)).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // The session is gone: the home page redirects again.
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});
