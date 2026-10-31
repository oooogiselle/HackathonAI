// Laptops and home-screen install. The phone layout is covered by the other
// specs (they run as an iPhone 13). A laptop shows that same phone layout in a
// centered column (LAYOUT = "phone" in src/lib/ask/layout.ts); if you switch to
// "wide", update the laptop test. Same server setup as demo-path.spec.ts.
import { expect, test } from "@playwright/test";

test.describe("on a laptop", () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test("the app shows as a centered phone-width column", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Needs board" })).toBeVisible();

    // Same as on a phone: the tab bar along the bottom, one card per row.
    const nav = page.getByRole("navigation", { name: "Main" });
    const navBox = (await nav.boundingBox())!;
    expect(navBox.y + navBox.height).toBe(800);
    expect(navBox.width).toBeLessThanOrEqual(448);
    expect(Math.abs(navBox.x + navBox.width / 2 - 640)).toBeLessThanOrEqual(1);

    const cards = page.getByRole("article");
    await expect(cards.nth(1)).toBeVisible();
    const [first, second] = [
      (await cards.nth(0).boundingBox())!,
      (await cards.nth(1).boundingBox())!,
    ];
    expect(second.y).toBeGreaterThan(first.y);
    expect(first.width).toBeLessThanOrEqual(448);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
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
