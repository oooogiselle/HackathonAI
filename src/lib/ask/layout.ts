// How DartAsk looks on a laptop. "phone" (now): the phone layout in a centered,
// phone-width column, so the app looks the same everywhere (it's a mobile app
// first). "wide": the tablet/laptop layout, with the tab bar on top and a card
// grid. Classes for it use the `wide:` / `wide-lg:` variants (globals.css),
// which only apply when this is "wide". Flip it here to switch.
export const LAYOUT: "phone" | "wide" = "phone";
