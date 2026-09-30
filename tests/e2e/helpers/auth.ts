import type { Page } from "@playwright/test";
import type { TestUser } from "./users";

// Signs in through the /login form (Sign in tab is the default).
// `exact: true` so "Password" does not also match the "Show password" toggle.
export async function signIn(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
