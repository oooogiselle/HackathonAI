import { describe, expect, it } from "vitest";

import { FLAG_COPY, MESSAGE_FLAGS, scamKeywordCheck } from "./scam-check";

describe("scamKeywordCheck", () => {
  it("flags paying outside Ask", () => {
    for (const text of [
      "You can just Venmo me instead",
      "zelle is easier for me",
      "Send it on Cash App",
      "cashapp works",
      "Can you buy an Amazon gift card?",
      "I only take bitcoin",
      "Let's pay directly, skip the fee",
      "Just pay me outside the app",
    ]) {
      expect(scamKeywordCheck(text), text).toBe("off-platform-payment");
    }
  });

  it("flags asking for ID or account numbers, and the numbers themselves", () => {
    for (const text of [
      "Send me your SSN so I can verify you",
      "what's your social security number?",
      "Text me your bank account number",
      "Can you send a photo of your passport?",
      "my ssn is 123-45-6789",
      "card 4111 1111 1111 1111",
    ]) {
      expect(scamKeywordCheck(text), text).toBe("id-number");
    }
  });

  it("leaves normal planning and help alone", () => {
    for (const text of [
      "I got my SSN last week, it was easy",
      "You'll need your passport and I-20 for the bank",
      "I'll pay through Ask once we're done",
      "Meet at Collis at 4",
      "Send me a pin of where you are",
      "Text me at 603-555-0142",
      "Which terminal?",
    ]) {
      expect(scamKeywordCheck(text), text).toBeNull();
    }
  });
});

describe("FLAG_COPY", () => {
  it("has calm copy for both sides of every flag, with no emojis", () => {
    for (const flag of MESSAGE_FLAGS) {
      for (const line of [FLAG_COPY[flag].sender, FLAG_COPY[flag].receiver]) {
        expect(line.length).toBeGreaterThan(20);
        expect(line).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }
  });
});
