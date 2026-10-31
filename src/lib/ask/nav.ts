// View transition types for navigations. Tag a Link (`transitionTypes={NAV.forward}`)
// or a push (`router.push(href, { transitionTypes: NAV.forward })`) so the page
// slides the right way. Untagged navigations (tab switches, redirects, the
// browser's own Back) crossfade. Styles live in globals.css (`.vt-*`).
export const NAV: Record<"forward" | "back", string[]> = {
  forward: ["nav-forward"],
  back: ["nav-back"],
};
