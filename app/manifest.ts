import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/calendar",
    name: "LifeOS — Personal Command Center",
    short_name: "LifeOS",
    description: "Calendar, activity tracking and finances in one personal command center.",
    start_url: "/calendar",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f6f4",
    theme_color: "#f6f6f4",
    categories: ["productivity", "finance", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Calendar", url: "/calendar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Finance", url: "/finance", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
