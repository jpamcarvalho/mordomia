import { expect, test } from "@playwright/test";

test("AC-14: the PWA manifest is served with name Mordomia", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ name: "Mordomia" });
});
