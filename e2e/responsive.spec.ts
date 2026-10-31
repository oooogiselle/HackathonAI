// Wider screens and home-screen install. The phone layout is covered by the
// other specs (they run as an iPhone 13); this one checks a laptop window and
// the web app manifest. Same server setup as demo-path.spec.ts.
import { expect, test } from "@playwright/test";

test.describe("on a laptop", () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test("the tab bar sits on top and board cards spread over columns", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Needs board" })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Main" });
    const navBox = await nav.boundingBox();
    expect(navBox?.y).toBe(0);
    await expect(nav.getByRole("link", { name: "Ask for help" })).toContainText("Ask for help");

    // The seeded board has several cards: at least two share a row.
    const cards = page.getByRole("article");
    await expect(cards.nth(1)).toBeVisible();
    const [first, second] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()];
    expect(first?.y).toBe(second?.y);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("the ask form stays a readable width", async ({ page }) => {
    await page.goto("/ask");
    const field = page.getByLabel("What do you need?");
    await expect(field).toBeVisible();
    const box = await field.boundingBox();
    expect(box?.width).toBeLessThan(640);
  });
});

test("the app can be added to a home screen", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();

  const res = await request.get(href!);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }

  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
    "content",
    "yes",
  );
  const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect((await request.get(touchIcon!)).ok()).toBe(true);
});
