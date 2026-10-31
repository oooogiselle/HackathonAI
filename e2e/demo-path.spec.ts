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
  // Who to ask: suggestions only, picked on a tap. Typing under Other offers a similar one.
  await expect(page.getByText("Suggested for your ask")).toBeVisible();
  const whoToAsk = page.getByRole("group", { name: "Who to ask" });
  await expect(whoToAsk.getByRole("button", { name: "Rides" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await whoToAsk.getByRole("button", { name: "Other", exact: true }).click();
  await page.getByLabel("Your category").fill("Airport pickup");
  await page.getByText("Similar:").locator("..").getByRole("button", { name: "Rides" }).click();
  await expect(whoToAsk.getByRole("button", { name: "Rides" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
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

  // Both said yes, so messages open: asker writes first, helper replies.
  await page.getByRole("link", { name: /^Rina/ }).click();
  await expect(page).toHaveURL(new RegExp(`${taskPath}/messages$`));
  await expect(page.getByText("You both said yes. Plan the details here.")).toBeVisible();
  await page.getByLabel("Message Rina").fill("I'm at the Collis porch");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("I'm at the Collis porch")).toBeVisible();
  await expect(page.getByLabel("Message Rina")).toHaveValue("");

  await helper.reload();
  await helper.getByRole("link", { name: /^Lin/ }).click();
  await expect(helper.getByText("I'm at the Collis porch")).toBeVisible();
  await helper.getByLabel("Message Lin").fill("On my way");
  await helper.keyboard.press("Enter");
  await expect(helper.getByText("On my way")).toBeVisible();
  // The asker's thread picks up the reply on its own.
  await expect(page.getByText("On my way")).toBeVisible();

  await page.getByRole("link", { name: "Task" }).click();
  await expect(page).toHaveURL(new RegExp(`${taskPath}$`));
  await expect(page.getByRole("link", { name: /^Rina/ })).toContainText("On my way");
  await helper.getByRole("link", { name: "Task" }).click();
  // Venmo is picked first ($16.81); PayPal and cards cost a bit more.
  await expect(page.getByRole("radio", { name: /Venmo/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Pay $16.81 and hold" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Credit or debit card/ })).toBeVisible();
  await page.getByRole("radio", { name: /PayPal/ }).click();
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

  // Rate your helper: 4 stars, "On time", a $2 tip charged to the PayPal used to hold.
  await page.getByRole("link", { name: "Rate your helper" }).click();
  await expect(page).toHaveURL(/\/review\?token=/);
  await expect(page.getByText("Payment released")).toBeVisible();
  await page.getByRole("radio", { name: "4 stars" }).click();
  await expect(page.getByText("+10")).toBeVisible();
  await page.getByRole("button", { name: "On time" }).click();
  await page.getByLabel("Comment").fill("Right on time with two suitcases. Thank you!");
  await page.getByRole("button", { name: "$2" }).click();
  await expect(page.getByText(/to the PayPal you used/)).toBeVisible();
  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(page).toHaveURL(new RegExp(`${taskPath}$`));
  await expect(page.getByText("You rated Rina 4 of 5.")).toBeVisible();

  // The helper sees it on Me: rating, trust points (10 + 2 for finishing) and the tip.
  await helper.goto("/me");
  await expect(helper.getByText("From 1 review as a helper")).toBeVisible();
  await expect(helper.getByText("Right on time with two suitcases. Thank you!")).toBeVisible();
  await expect(helper.getByText("12", { exact: true })).toBeVisible();
  await expect(helper.getByText("$17.00")).toBeVisible();

  await page.getByRole("link", { name: "Write a thank-you" }).click();
  await expect(page).toHaveURL(/\/thanks\?token=/);
  await page.getByPlaceholder("Thank you so much for the ride!").fill("Thanks for the ride, Rina!");
  await page.getByRole("button", { name: "Send thank-you" }).click();
  await expect(page.getByRole("heading", { name: /Thank-you sent/ })).toBeVisible();
});

test('"Write my essay" is never posted: an honest rewrite or tutoring', async ({ page }) => {
  await page.goto("/ask");
  await page.getByLabel("What do you need?").fill("Write my essay");
  await page.getByLabel("Details").fill("History class, due Friday.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/check$/);
  await expect(page.getByRole("heading", { name: "We can't post this" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);

  // Canned rewrite (no AI key in e2e), keeping the subject.
  await expect(
    page.getByText("Talk through my history essay outline", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Book tutoring" }).click();
  await expect(page).toHaveURL(/\/resources\?type=tutoring$/);

  // Back on Quick check, the rewrite passes as an everyday ask.
  await page.goBack();
  await page.getByRole("button", { name: "Use this rewrite" }).click();
  await expect(page.getByRole("heading", { name: "Everyday ask" })).toBeVisible();
  await expect(page.getByText("Not graded schoolwork")).toBeVisible();
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
