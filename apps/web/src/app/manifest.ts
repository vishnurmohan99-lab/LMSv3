import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Elearning — AI Exam Prep",
    short_name: "Elearning",
    description: "Study with intent. Rank with proof.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Orange, not the app's cream: this is the colour behind the Android native launch
    // splash (icon on background_color) and the standalone window before first paint, so
    // it flows seamlessly into the orange in-app Rise splash instead of flashing cream.
    background_color: "#f26a1b",
    theme_color: "#f26a1b",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
