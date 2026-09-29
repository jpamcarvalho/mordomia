import { expect, test } from "@playwright/test";
import { createConfirmedUser, deleteUser, type TestUser } from "./helpers/users";

test("AC-12: a signed-out request gets no suggestions (redirect or 401)", async ({ request }) => {
  const res = await request.get("/api/places?q=pizza", { maxRedirects: 0 });

  const location = res.headers()["location"];
  const redirectedToLogin =
    res.status() >= 300 &&
    res.status() < 400 &&
    location !== undefined &&
    new URL(location, "http://localhost").pathname === "/login";
  expect(redirectedToLogin || res.status() === 401).toBe(true);
  expect(await res.text()).not.toContain("suggestions");
});

test.describe("signed in", () => {
  let user: TestUser;

  test.beforeEach(async () => {
    user = await createConfirmedUser();
  });

  test.afterEach(async () => {
    await deleteUser(user.id);
  });

  test("AC-13: a query shorter than 2 characters returns no suggestions", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(user.email);
    await page.getByPlaceholder("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);

    const res = await page.request.get("/api/places?q=a", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ suggestions: [] });
  });
});
