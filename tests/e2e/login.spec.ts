import { expect, test } from "@playwright/test";

const ACCENT = "rgb(194, 65, 12)";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
});

test("AC-2: the submit button and the active tab use the accent color", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Entrar" })).toHaveCSS(
    "background-color",
    ACCENT,
  );
  await expect(page.getByRole("tab", { name: "Entrar" })).toHaveCSS("color", ACCENT);

  await page.getByRole("tab", { name: "Registar" }).click();
  await expect(page.getByRole("tab", { name: "Registar" })).toHaveCSS("color", ACCENT);
  await expect(page.getByRole("button", { name: "Criar conta" })).toHaveCSS(
    "background-color",
    ACCENT,
  );
});

test("AC-13: the tagline is shown below the Mordomia heading", async ({ page }) => {
  const heading = page.getByRole("heading", { name: "Mordomia" });
  const tagline = page.getByText(
    "Os restaurantes onde foste e os que queres experimentar, com amigos.",
  );
  await expect(heading).toBeVisible();
  await expect(tagline).toBeVisible();

  const headingBox = (await heading.boundingBox())!;
  const taglineBox = (await tagline.boundingBox())!;
  expect(taglineBox.y).toBeGreaterThanOrEqual(headingBox.y + headingBox.height);
});

test("AC-14: each field has a visible label; Username only in Sign up", async ({ page }) => {
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Palavra-passe", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Nome de utilizador", { exact: true })).toHaveCount(0);

  await page.getByRole("tab", { name: "Registar" }).click();
  await expect(page.getByLabel("Nome de utilizador", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Palavra-passe", { exact: true })).toBeVisible();
});

test("AC-15: Sign in / Sign up tabs switch the mode", async ({ page }) => {
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(2);
  const signInTab = page.getByRole("tab", { name: "Entrar" });
  const signUpTab = page.getByRole("tab", { name: "Registar" });
  await expect(signInTab).toHaveAttribute("aria-selected", "true");
  await expect(signUpTab).toHaveAttribute("aria-selected", "false");

  await signUpTab.click();
  await expect(signUpTab).toHaveAttribute("aria-selected", "true");
  await expect(signInTab).toHaveAttribute("aria-selected", "false");
  await expect(page.getByLabel("Nome de utilizador", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar conta" })).toBeVisible();

  await expect(page.getByText("No account? Sign up")).toHaveCount(0);
  await expect(page.getByText("Have an account? Sign in")).toHaveCount(0);
});

test("AC-16: the password field has a show/hide toggle", async ({ page }) => {
  const password = page.getByLabel("Palavra-passe", { exact: true });
  await expect(password).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "Mostrar palavra-passe" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Esconder palavra-passe" })).toHaveText("Esconder");

  await page.getByRole("button", { name: "Esconder palavra-passe" }).click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Mostrar palavra-passe" })).toHaveText("Mostrar");
});
