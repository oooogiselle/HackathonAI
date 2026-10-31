// The tab screens (Claimed, Inbox, Me), the private route for personal topics,
// and the crisis screen's call links. Same server setup as demo-path.spec.ts.
import { type Browser, devices, expect, type Page, test } from "@playwright/test";

async function signIn(page: Page, firstName: string) {
  await page.getByRole("button", { name: "Sign in with Dartmouth" }).click();
  await page.getByLabel("First name").fill(firstName);
  await page.getByLabel("Dartmouth email").fill(`${firstName.toLowerCase()}@dartmouth.edu`);
  await page.getByRole("button", { name: "Continue" }).click();
}

async function newPhone(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ ...devices["iPhone 13"], baseURL });
  return context.newPage();
}

/** Fills the form at /ask and continues to Quick check. */
async function fillAsk(page: Page, what: string, details: string) {
  await page.goto("/ask");
  await page.getByLabel("What do you need?").fill(what);
  await page.getByLabel("Details").fill(details);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/check$/);
}

test("every tab opens, and asks you to sign in when signed out", async ({ page }) => {
  await page.goto("/");
  for (const tab of ["Claimed", "Inbox", "Me"]) {
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: tab, exact: true })
      .click();
    await expect(page.getByRole("heading", { name: tab, exact: true })).toBeVisible();
    await expect(page.getByText("Sign in to see this")).toBeVisible();
  }
});

test("Claimed and Inbox show the asker's next step after a claim", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto(`/signin?next=${encodeURIComponent("/ask")}`);
  await signIn(page, "Noor");
  await fillAsk(
    page,
    "Carry a mini-fridge upstairs",
    "From the lobby of Mass Row to the 3rd floor.",
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/where$/);
  await page.getByRole("button", { name: /^Post to the board/ }).click();
  await expect(page).toHaveURL(/\/h\/[^/]+$/);
  const taskPath = new URL(page.url()).pathname;
  await expect(page.getByRole("button", { name: "Share link" })).toBeVisible();

  await page.goto("/claimed");
  await expect(page.getByText("My asks · 1")).toBeVisible();
  await expect(page.getByText("Waiting for a helper")).toBeVisible();

  // A helper claims it (paid ask: the claim button says what's missing).
  const helper = await newPhone(browser, baseURL);
  await helper.goto(`/signin?next=${encodeURIComponent(taskPath)}`);
  await signIn(helper, "Omar");
  await expect(helper.getByText(/Turn on "I can accept payment"/)).toBeVisible();
  await helper.getByLabel("I can accept payment").check();
  await expect(helper.getByText("Add your payout account to help.")).toBeVisible();
  await helper.getByLabel("Payout account (connected with Stripe)").fill("4242");
  await helper.getByRole("button", { name: "I can help" }).click();
  await expect(helper.getByText("Waiting for the asker to confirm.")).toBeVisible();

  await helper.goto("/claimed");
  await expect(helper.getByText("I'm helping · 1")).toBeVisible();
  await expect(helper.getByText("Waiting for the asker to confirm")).toBeVisible();

  await page.goto("/claimed");
  await expect(page.getByText("Your turn")).toBeVisible();
  // The helper shows up by alias, never by name.
  await expect(
    page.getByText(/[A-Z][a-z]+ [A-Z][a-z]+ \d{2} can help\. Confirm to lock it in$/),
  ).toBeVisible();
  await expect(page.getByText(/\bOmar\b/)).toHaveCount(0);

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Inbox/ }).click();
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(page.getByRole("link", { name: / can help/ }).first()).toBeVisible();
  await expect(page.getByText(/\bOmar\b/)).toHaveCount(0);
});

test("Me saves helper settings and explains a missing payout", async ({ page }) => {
  await page.goto(`/signin?next=${encodeURIComponent("/me")}`);
  await signIn(page, "Kai");
  await expect(page).toHaveURL(/\/me$/);
  // The helper card preview follows the form, and shows an alias, never the name.
  const preview = page.getByRole("region", { name: "How others see you" });
  await expect(preview.getByText(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/)).toBeVisible();
  await expect(preview.getByText(/\bKai\b/)).toHaveCount(0);
  await page.getByLabel("A line about you").fill("Senior with a car.");
  await expect(preview.getByText("Senior with a car.")).toBeVisible();
  await page.getByRole("button", { name: "Junior" }).click();
  await expect(preview.getByText("Junior")).toBeVisible();
  const tuesdayEvening = page.getByRole("button", { name: "Tuesday evening" });
  const wasFree = await tuesdayEvening.getAttribute("aria-pressed");
  await tuesdayEvening.click();
  await expect(tuesdayEvening).toHaveAttribute(
    "aria-pressed",
    wasFree === "true" ? "false" : "true",
  );
  const paySwitch = page.getByRole("switch", { name: /I can accept payment/ });
  if ((await paySwitch.getAttribute("aria-checked")) !== "true") await paySwitch.click();
  await page.getByLabel(/Venmo username|Last 4 digits/).fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Add where your payouts go, or turn payment off.")).toBeVisible();
  await page.getByLabel(/Venmo username|Last 4 digits/).fill("@kai");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("A line about you")).toHaveValue("Senior with a car.");

  // The blurb goes through the privacy check on Save, with Undo.
  await page.getByLabel("A line about you").fill("Senior with a car. Text me at 603-555-0142.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Removed identifying details:")).toBeVisible();
  await expect(page.getByLabel("A line about you")).not.toHaveValue(/603-555-0142/);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("A line about you")).toHaveValue(/603-555-0142/);
  await page.getByRole("button", { name: "Remove them again" }).click();
  await expect(page.getByLabel("A line about you")).not.toHaveValue(/603-555-0142/);
  await expect(page.getByRole("button", { name: "Tuesday evening" })).toHaveAttribute(
    "aria-pressed",
    wasFree === "true" ? "false" : "true",
  );
});

test("Me turns your own words into chips and specifics, added only on a tap", async ({ page }) => {
  await page.goto(`/signin?next=${encodeURIComponent("/me")}`);
  await signIn(page, "Bo");
  await expect(page).toHaveURL(/\/me$/);
  const rides = page
    .getByRole("group", { name: "Interests" })
    .getByRole("button", { name: "Rides", exact: true });
  await expect(rides).toHaveAttribute("aria-pressed", "false");

  await page
    .getByLabel("Or say it in your own words")
    .fill("I have a car and can drive people to the airport.");
  await page.getByRole("button", { name: "Turn into chips" }).click();
  const offered = page.getByRole("status").filter({ hasText: "From what you wrote" });
  await expect(offered.getByRole("button", { name: "airport" })).toBeVisible();
  // Nothing changes until a tap.
  await expect(rides).toHaveAttribute("aria-pressed", "false");

  await offered.getByRole("button", { name: "Add all" }).click();
  await expect(rides).toHaveAttribute("aria-pressed", "true");
  const specifics = page.getByRole("list", { name: "Specifics" });
  await expect(specifics.getByText("airport")).toBeVisible();
  await expect(page.getByText("All added. Save to keep them.")).toBeVisible();

  // Type one by hand too, then save and reload.
  await page.getByLabel("Add a specific").fill("Korean");
  await page.keyboard.press("Enter");
  await expect(specifics.getByText("korean")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("list", { name: "Specifics" }).getByText("korean")).toBeVisible();
  await expect(rides).toHaveAttribute("aria-pressed", "true");
});

test("a personal topic goes only to helpers the asker picks", async ({ page }) => {
  await page.goto(`/signin?next=${encodeURIComponent("/ask")}`);
  await signIn(page, "Ana");
  await fillAsk(
    page,
    "Someone who has done OPT",
    "20 minutes to walk me through my visa paperwork.",
  );
  await expect(page.getByRole("heading", { name: "Private topic" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "This one stays private" })).toBeVisible();
  await page.getByRole("link", { name: "Choose helpers" }).click();
  await expect(page).toHaveURL(/\/private$/);
  const helpers = page.getByRole("list", { name: "Suggested helpers" }).getByRole("checkbox");
  await expect(helpers.first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Post to the board instead/ })).toHaveCount(0);
  await page.getByRole("button", { name: /^Send to \d (person|people)$/ }).click();
  await expect(page).toHaveURL(/\/h\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Waiting for a helper" })).toBeVisible();
  // Never on the board, so no link to share around.
  await expect(page.getByRole("button", { name: "Share link" })).toHaveCount(0);
});

test("the crisis screen's numbers are tap-to-call, with a way back", async ({ page }) => {
  await page.goto("/resources?type=crisis");
  await expect(page.getByRole("link", { name: "988" })).toHaveAttribute("href", "tel:988");
  await expect(page.getByRole("link", { name: "911" }).first()).toHaveAttribute("href", "tel:911");
  await page.getByRole("link", { name: "Back to the needs board" }).click();
  await expect(page.getByRole("heading", { name: "Needs board" })).toBeVisible();
});
