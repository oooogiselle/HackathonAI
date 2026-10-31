import type { MetadataRoute } from "next";

// Lets people add DartAsk to their phone's home screen; it then opens full
// screen like an app. No service worker: the board is live data, so there is
// nothing useful to show offline, and install doesn't need one.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DartAsk",
    short_name: "DartAsk",
    description: "Post a small favor, find a classmate who can help, and get things done.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f6f4",
    theme_color: "#f3f6f4",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
