import { describe, expect, it, vi } from "vitest";

// A tiny cookie jar standing in for next/headers in one browser.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

const { getMe, mockSignIn, mockSignOut } = await import("./session");
const { getCurrentUser } = await import("@/lib/ask/mock-session");

describe("mocked sign-in", () => {
  it("needs a first name and a school email", async () => {
    expect("error" in (await mockSignIn({ firstName: "", email: "sam@northfield.edu" }))).toBe(
      true,
    );
    expect(await mockSignIn({ firstName: "Sam", email: "sam@gmail.com" })).toEqual({
      error: "Please use your school (.edu) email.",
    });
    expect(await getMe()).toBeNull();
  });

  it("signs in, keeps the same account for the same email, and signs out", async () => {
    await mockSignIn({ firstName: "Sam", email: "Sam@Northfield.edu" });
    expect(await getMe()).toEqual({ firstName: "Sam", email: "sam@northfield.edu" });
    const first = await getCurrentUser();

    await mockSignIn({ firstName: "Sammy", email: "sam@northfield.edu" });
    const again = await getCurrentUser();
    expect(again?.id).toBe(first?.id);
    expect(again?.firstName).toBe("Sammy");

    await mockSignOut();
    expect(await getMe()).toBeNull();
  });

  it("ignores a made-up session cookie", async () => {
    jar.set("ask_session", "not-a-real-session");
    expect(await getCurrentUser()).toBeNull();
  });
});
