// Screens from the DartAsk design that aren't on the demo path: Welcome,
// Create account + Verify, username sign-in, the helper's "Let go", the
// Inbox tabs, Payouts and blocked people. Same server setup as demo-path.spec.ts.
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

test("create an account with two codes, then sign in with the password", async ({ page }) => {
  await page.goto("/welcome");
  await expect(page.getByText("Post. Find. Help. Together.")).toBeVisible();
  await page.getByRole("link", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/signup$/);

  await page.getByLabel("Username").fill("kenji");
  await page.getByLabel("Password").fill("correct-horse");
  await page.getByLabel("School email").fill("kenji@gmail.com");
  await page.getByLabel("Mobile number (+1)").fill("(603) 555-0123");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText("Use your @dartmouth.edu account.")).toBeVisible();
  await page.getByLabel("School email").fill("kenji@dartmouth.edu");
  await page.getByRole("button", { name: "Send code" }).click();

  // No email or SMS keys in e2e, so demo mode shows the real codes on screen.
  await expect(page.getByRole("heading", { name: "Verify both" })).toBeVisible();
  const emailCode = (await page.getByTestId("demo-email-code").textContent())!;
  const phoneCode = (await page.getByTestId("demo-phone-code").textContent())!;
  expect(emailCode).toMatch(/^\d{6}$/);

  // A wrong code is refused and counts as a try.
  const wrong = emailCode === "000000" ? "111111" : "000000";
  await page.getByLabel("School email code").fill(wrong);
  await page.getByLabel("Phone code").fill(phoneCode);
  await page.getByRole("button", { name: "Verify and join" }).click();
  await expect(page.getByText(/That school email code isn't right\./)).toBeVisible();
  await expect(page.getByRole("button", { name: /Resend in/ }).first()).toBeDisabled();

  await page.getByLabel("School email code").fill(emailCode);
  await page.getByRole("button", { name: "Verify and join" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Signed in as kenji" })).toBeVisible();

  await page.goto("/me");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/signin?next=/me");
  await page.getByLabel("Username or school email").fill("kenji");
  await page.getByLabel("Password", { exact: true }).fill("not-my-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Wrong username, email or password.")).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("correct-horse");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByLabel("First name")).toHaveValue("kenji");
});

test("a helper lets go, the ask reopens, and the asker sees it in Inbox", async ({
  page,
  browser,
  baseURL,
}) => {
  // Asker posts a favor (no payment setup needed to claim).
  await page.goto(`/signin?next=${encodeURIComponent("/ask")}`);
  await signIn(page, "Ines");
  await page.getByLabel("What do you need?").fill("Hold the door while I move a couch");
  await page.getByLabel("Details").fill("Ten minutes at the Fayerweather entrance.");
  await page.getByLabel("Price in dollars").fill("0");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/check$/);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Post to the board/ }).click();
  await expect(page).toHaveURL(/\/h\/[^/]+$/);
  const taskPath = new URL(page.url()).pathname;

  const helper = await newPhone(browser, baseURL);
  await helper.goto(`/signin?next=${encodeURIComponent(taskPath)}`);
  await signIn(helper, "Theo");
  await helper.getByRole("button", { name: "Claim this task" }).click();
  await expect(helper.getByText("Waiting for the asker to confirm.")).toBeVisible();

  helper.once("dialog", (d) => d.accept());
  await helper.getByRole("button", { name: "Let go of this ask" }).click();
  await expect(helper.getByRole("button", { name: "Claim this task" })).toBeVisible();

  // Asker: the ask is open again, and Inbox > Updates says why.
  await expect(page.getByText("Waiting for a helper")).toBeVisible();
  await page.goto("/inbox?tab=updates");
  await expect(page.getByText("Your helper let go")).toBeVisible();
  await page.getByRole("link", { name: "Actions" }).click();
  await expect(page).toHaveURL(/tab=actions/);
  await expect(page.getByText("Your helper let go")).toHaveCount(0);
  await page.getByRole("link", { name: "Tasks" }).click();
  await expect(page).toHaveURL(/topic=tasks/);
});

test("Me links to Payouts and lists blocked people", async ({ page }) => {
  await page.goto(`/signin?next=${encodeURIComponent("/me")}`);
  await signIn(page, "Sana");
  await expect(page.getByText("Available balance")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Blocked people" })).toBeVisible();
  await expect(page.getByText(/^None\./)).toBeVisible();
  await expect(page.getByRole("switch", { name: /Show my class year/ })).toBeVisible();

  await page.getByRole("link", { name: /Payouts/ }).click();
  await expect(page).toHaveURL(/\/me\/payouts$/);
  await expect(page.getByRole("heading", { name: "Your earnings" })).toBeVisible();
  await expect(page.getByText("No paid tasks yet.", { exact: false })).toBeVisible();
});
