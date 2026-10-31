import { describe, expect, it } from "vitest";

import { nextStep } from "./next-step";
import type { PublicCard } from "./types";

const base = {
  viewer: "asker",
  status: "open",
  price: 15,
  heldByAlias: "Steady Loon 42",
} as Parameters<typeof nextStep>[0];

const card = (patch: Partial<PublicCard>) => nextStep({ ...base, ...patch });

describe("nextStep", () => {
  it("asker waits while the ask is open", () => {
    expect(card({})).toEqual({ label: "Waiting for a helper", yourTurn: false });
  });

  it("asker confirms a helper who claimed it", () => {
    expect(card({ status: "held" })).toEqual({
      label: "Steady Loon 42 can help. Confirm to lock it in",
      yourTurn: true,
    });
  });

  it("asker pays the full total, fees included, to hold a paid ask", () => {
    expect(card({ status: "confirmed" })).toEqual({ label: "Pay $17.28 to hold", yourTurn: true });
  });

  it("a favor skips the pay step", () => {
    expect(card({ status: "confirmed", price: 0 })).toEqual({
      label: "Steady Loon 42 is on it",
      yourTurn: false,
    });
  });

  it("asker confirms after the helper marks it done, unless a problem was reported", () => {
    const held = { status: "confirmed", price: 0, helperDoneAt: 1 } as const;
    expect(card(held).yourTurn).toBe(true);
    expect(card({ ...held, problemReportedAt: 2 }).yourTurn).toBe(false);
  });

  it("asker is nudged to say thank you once, then not again", () => {
    expect(card({ status: "done" }).yourTurn).toBe(true);
    expect(card({ status: "done", thanks: "Thanks!" }).yourTurn).toBe(false);
  });

  it("helper taps Done only after a paid ask is held", () => {
    const helper = { viewer: "helper", status: "confirmed" } as const;
    expect(card(helper)).toEqual({ label: "Waiting for the asker to pay", yourTurn: false });
    const payment = { status: "held" } as PublicCard["payment"];
    expect(card({ ...helper, payment })).toEqual({
      label: "Tap Done once you've helped",
      yourTurn: true,
    });
  });

  it("expired and cancelled are never anyone's turn", () => {
    expect(card({ status: "expired" }).yourTurn).toBe(false);
    expect(card({ status: "cancelled", viewer: "helper" }).yourTurn).toBe(false);
  });
});
