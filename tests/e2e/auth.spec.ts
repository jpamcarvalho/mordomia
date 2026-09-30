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
  await page.getByRole("tab", { name: "Registar" }).click();
  await page.getByLabel("Nome de utilizador", { exact: true }).fill("a!");
  await page.getByLabel("Email", { exact: true }).fill("invalid-username@example.test");
  await page.getByLabel("Palavra-passe", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(
    page.getByText("O nome de utilizador tem de ter 3–24 caracteres: letras, números ou _."),
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

    await page.getByRole("button", { name: "Menu da conta" }).click();
    await expect(page.getByRole("menu")).toContainText(`@${user.username}`);

    await page.getByRole("menuitem", { name: "Terminar sessão" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // The session is gone: the home page redirects again.
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});
