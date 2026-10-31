// The demo path as built today: the board (/) -> Ask for help -> form (/ask) -> Where -> Share (anonymous) -> post
// -> helper claims from /h/<token> in a second tab -> Matched -> Thank you.
// Plus the two safety redirects. See playwright.config.ts for the server setup.
import { expect, test } from "@playwright/test";

test("the landing page is the needs board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Needs board" })).toBeVisible();
  await expect(page.getByText("Ride to Bradley Airport")).toBeVisible();
  await page.getByRole("link", { name: "Errands" }).click();
  await expect(page.getByText("Lend me a warm coat for a weekend")).toHaveCount(0);
  await page.getByRole("link", { name: "Ask for help" }).click();
  await expect(page).toHaveURL(/\/ask$/);
  await expect(page.getByLabel("Title")).toBeVisible();
});

test("an ask goes from the form to a thank-you", async ({ page, context }) => {
  await page.goto("/ask");
  await page.getByLabel("Title").fill("Ride to BTV airport");
  await page.getByLabel("Details").fill("I have two suitcases and my flight is at 10am Saturday.");
  await page.getByLabel("Where").fill("From East Hall");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/where$/);
  await page
    .getByRole("button", { name: /Preview/ })
    .first()
    .click();

  await expect(page).toHaveURL(/\/share$/);
  await page.getByRole("button", { name: "Post anonymously" }).click();
  await expect(
    page.getByText(/Removed identifying details|No identifying details found/),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Post to / }).click();

  await expect(page).toHaveURL(/\/matched\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Posted!" })).toBeVisible();

  // The helper opens the link from the group post in another tab and claims it.
  const [helper] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("link", { name: "Open the helper link (demo)" }).click(),
  ]);
  await expect(helper).toHaveURL(/\/h\/[^/]+$/);
  await helper.getByLabel("First name").fill("Rina");
  await helper.getByLabel("School email").fill("rina@northfield.edu");
  await helper.getByRole("button", { name: "I can help" }).click();
  await expect(helper.getByText("Thank you, Rina!")).toBeVisible();

  // One ask, one claim: anyone opening the link now sees it's taken.
  await helper.reload();
  await expect(helper.getByText("Someone already offered to help")).toBeVisible();
  await expect(helper.getByRole("button", { name: "I can help" })).toHaveCount(0);

  // The asker's Matched page polls and shows the helper and a public spot.
  await expect(page.getByRole("heading", { name: "Rina can help!" })).toBeVisible();
  await expect(page.getByText("Suggested meeting spot (public)")).toBeVisible();

  await page.getByRole("button", { name: "Say thank you" }).click();
  await expect(page).toHaveURL(/\/thanks$/);
  await page.getByPlaceholder("Thank you so much for the ride!").fill("Thanks for the ride, Rina!");
  await page.getByRole("button", { name: "Send thank-you" }).click();
  await expect(page.getByRole("heading", { name: /Thank-you sent/ })).toBeVisible();
});

test('"Write my essay" goes to tutoring, not the board', async ({ page }) => {
  await page.goto("/ask");
  await page.getByLabel("Title").fill("Write my essay");
  await page.getByLabel("Details").fill("History class, due Friday.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/resources\?type=tutoring$/);
});

test("a crisis message shows professional resources only", async ({ page }) => {
  await page.goto("/ask");
  await page.getByLabel("Title").fill("I want to die");
  await page.getByLabel("Details").fill("I don't know who to talk to.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/resources\?type=crisis$/);
  await expect(
    page.getByRole("heading", { name: "You don't have to handle this alone" }),
  ).toBeVisible();
});
