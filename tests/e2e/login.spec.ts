import { expect, test } from "@playwright/test";

const ACCENT = "rgb(194, 65, 12)";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
});

test("AC-2: the submit button and the active tab use the accent color", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Sign in" })).toHaveCSS(
    "background-color",
    ACCENT,
  );
  await expect(page.getByRole("tab", { name: "Sign in" })).toHaveCSS("color", ACCENT);

  await page.getByRole("tab", { name: "Sign up" }).click();
  await expect(page.getByRole("tab", { name: "Sign up" })).toHaveCSS("color", ACCENT);
  await expect(page.getByRole("button", { name: "Create account" })).toHaveCSS(
    "background-color",
    ACCENT,
  );
});

test("AC-13: the tagline is shown below the Mordomia heading", async ({ page }) => {
  const heading = page.getByRole("heading", { name: "Mordomia" });
  const tagline = page.getByText(
    "The restaurants you went to and the ones you want to try, with friends.",
  );
  await expect(heading).toBeVisible();
  await expect(tagline).toBeVisible();

  const headingBox = (await heading.boundingBox())!;
  const taglineBox = (await tagline.boundingBox())!;
  expect(taglineBox.y).toBeGreaterThanOrEqual(headingBox.y + headingBox.height);
});

test("AC-14: each field has a visible label; Username only in Sign up", async ({ page }) => {
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Username", { exact: true })).toHaveCount(0);

  await page.getByRole("tab", { name: "Sign up" }).click();
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});

test("AC-15: Sign in / Sign up tabs switch the mode", async ({ page }) => {
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(2);
  const signInTab = page.getByRole("tab", { name: "Sign in" });
  const signUpTab = page.getByRole("tab", { name: "Sign up" });
  await expect(signInTab).toHaveAttribute("aria-selected", "true");
  await expect(signUpTab).toHaveAttribute("aria-selected", "false");

  await signUpTab.click();
  await expect(signUpTab).toHaveAttribute("aria-selected", "true");
  await expect(signInTab).toHaveAttribute("aria-selected", "false");
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();

  await expect(page.getByText("No account? Sign up")).toHaveCount(0);
  await expect(page.getByText("Have an account? Sign in")).toHaveCount(0);
});

test("AC-16: the password field has a show/hide toggle", async ({ page }) => {
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Hide password" })).toHaveText("Hide");

  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Show password" })).toHaveText("Show");
});
