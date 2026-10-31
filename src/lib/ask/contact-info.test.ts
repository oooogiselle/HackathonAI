import { describe, expect, it } from "vitest";

import { findContactInfo } from "./contact-info";

describe("findContactInfo", () => {
  it("finds emails and phone numbers", () => {
    expect(findContactInfo("email me at lin.w@dartmouth.edu")).toEqual(["lin.w@dartmouth.edu"]);
    expect(findContactInfo("text 603-555-0142")).toEqual(["603-555-0142"]);
    expect(findContactInfo("call +1 (603) 555 0142 please")).toEqual(["+1 (603) 555 0142"]);
    expect(findContactInfo("a@b.co or 6035550142")).toEqual(["a@b.co", "6035550142"]);
  });

  it("ignores times, rooms and prices", () => {
    expect(findContactInfo("meet at 3pm in room 2")).toEqual([]);
    expect(findContactInfo("$15 for 45 minutes on 10/31")).toEqual([]);
  });
});
