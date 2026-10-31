// The demo path: the board (/) -> Ask for help -> form (/ask) -> Where -> Share
// (anonymous) -> posted to the board and a group -> a second student opens the
// task (board or group link), signs in with the mocked Dartmouth SSO and claims
// it -> a third sees "Already taken" -> the asker confirms and pays to hold ->
// the helper taps Done -> the asker confirms done -> thank-you.
// Plus the two safety redirects. See playwright.config.ts for the server setup.
import { type Browser, devices, expect, type Page, test } from "@playwright/test";

/** Mocked "Sign in with Dartmouth", then back to `next`. */
async function signIn(page: Page, firstName: string, email: string) {
  await page.getByRole("button", { name: "Sign in with Dartmouth" }).click();
  await page.getByLabel("First name").fill(firstName);
  await page.getByLabel("Dartmouth email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
}

/** Another student on another phone: separate cookies, same server. */
async function newPhone(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ ...devices["iPhone 13"], baseURL });
  return context.newPage();
}

test("the landing page is the needs board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Needs board" })).toBeVisible();
  await expect(page.getByText("Ride to Lebanon airport")).toBeVisible();
  await page.getByRole("link", { name: "Ask for help" }).click();
  await expect(page).toHaveURL(/\/ask$/);
  await expect(page.getByLabel("What do you need?")).toBeVisible();
});

test("a posted ask is claimed by another student and closed with a thank-you", async ({
  page,
  browser,
  baseURL,
}) => {
  // Asker: only Dartmouth accounts can sign in.
  await page.goto(`/signin?next=${encodeURIComponent("/ask")}`);
  await signIn(page, "Lin", "lin@gmail.com");
  await expect(page.getByText("Use your @dartmouth.edu account.")).toBeVisible();
  await page.getByLabel("Dartmouth email").fill("lin@dartmouth.edu");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/ask$/);

  await page.getByLabel("What do you need?").fill("Ride to Manchester airport");
  await page.getByLabel("Details").fill("I have two suitcases and my flight is at 10am Saturday.");
  // Category: suggestions only, picked on a tap. Typing under Other offers a similar one.
  await expect(page.getByText("Suggested for your ask")).toBeVisible();
  const category = page.getByRole("group", { name: "Category" });
  await category.getByRole("button", { name: "Other", exact: true }).click();
  await page.getByLabel("Your category").fill("Airport pickup");
  await page.getByText("Similar:").locator("..").getByRole("button", { name: "Rides" }).click();
  await expect(category.getByRole("button", { name: "Rides" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Where").fill("From East Wheelock");
  await page.getByLabel("Price in dollars").fill("15");
  await page.getByRole("button", { name: "Continue" }).click();

  // Quick check runs the safety check on the final wording.
  await expect(page).toHaveURL(/\/check$/);
  await expect(page.getByRole("heading", { name: "Everyday ask" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Where it goes: board + a GroupMe group, anonymous by default.
  await expect(page).toHaveURL(/\/where$/);
  await page.getByRole("link", { name: "Preview" }).click();
  await expect(page).toHaveURL(/\/share$/);
  await page.getByRole("button", { name: "Use this group" }).click();
  await expect(page).toHaveURL(/\/where$/);
  await expect(page.getByRole("button", { name: /Post anonymously/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByText(/Removed identifying details|No identifying details found/),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Post to the board/ }).click();

  await expect(page).toHaveURL(/\/h\/[^/]+$/);
  await expect(page.getByText("Waiting for a helper")).toBeVisible();
  const taskPath = new URL(page.url()).pathname;

  // Helper, on another phone: finds it on the board and claims it.
  const helper = await newPhone(browser, baseURL);
  await helper.goto("/");
  await helper.getByRole("link", { name: "Ride to Manchester airport" }).click();
  await expect(helper).toHaveURL(new RegExp(`${taskPath}$`));
  await helper.getByRole("link", { name: "Claim this task" }).click();
  await signIn(helper, "Rina", "rina@dartmouth.edu");
  await expect(helper).toHaveURL(new RegExp(`${taskPath}$`));
  // Paid ask: the mocked helper setup comes first.
  await helper.getByLabel("I can accept payment").check();
  await helper.getByLabel("Payout account (connected with Stripe)").fill("4242");
  await helper.getByRole("button", { name: "Claim this task" }).click();
  await expect(helper.getByText("Waiting for the asker to confirm.")).toBeVisible();

  // One ask, one claim: anyone opening the same link now sees it's taken.
  const late = await newPhone(browser, baseURL);
  await late.goto(taskPath);
  await expect(late.getByText("Already taken")).toBeVisible();
  await expect(late.getByRole("link", { name: "Claim this task" })).toHaveCount(0);

  // Asker: the page refreshes on its own and shows who said yes.
  await expect(page.getByText("Rina can help!")).toBeVisible();
  await page.getByRole("button", { name: "Confirm Rina" }).click();
  await expect(page.getByText("Meet at (public)")).toBeVisible();
  await page.getByRole("button", { name: "Pay $17.28 and hold" }).click();
  await expect(page.getByText("Rina is on it")).toBeVisible();

  // Helper: starts once it's held, then marks it done.
  await expect(helper.getByText("$15.00 is held for you.")).toBeVisible();
  await helper.getByRole("button", { name: "Done", exact: true }).click();
  await expect(helper.getByText("Marked done")).toBeVisible();

  // Asker: confirms, which releases the payment.
  await expect(page.getByText("Rina marked it done")).toBeVisible();
  await page.getByRole("button", { name: "Confirm done" }).click();
  await expect(page.getByText("$15.00 released to Rina.")).toBeVisible();
  await expect(helper.getByText("$15.00 released to you.")).toBeVisible();

  await page.getByRole("link", { name: "Write a thank-you" }).click();
  await expect(page).toHaveURL(/\/thanks\?token=/);
  await page.getByPlaceholder("Thank you so much for the ride!").fill("Thanks for the ride, Rina!");
  await page.getByRole("button", { name: "Send thank-you" }).click();
  await expect(page.getByRole("heading", { name: /Thank-you sent/ })).toBeVisible();
});

test('"Write my essay" goes to tutoring, not the board', async ({ page }) => {
  await page.goto("/ask");
  await page.getByLabel("What do you need?").fill("Write my essay");
  await page.getByLabel("Details").fill("History class, due Friday.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/resources\?type=tutoring$/);
});

test("a crisis message shows professional resources only", async ({ page }) => {
  await page.goto("/ask");
  await page.getByLabel("What do you need?").fill("I want to die");
  await page.getByLabel("Details").fill("I don't know who to talk to.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/resources\?type=crisis$/);
  await expect(
    page.getByRole("heading", { name: "You don't have to handle this alone" }),
  ).toBeVisible();
});
