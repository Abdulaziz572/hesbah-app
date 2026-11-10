import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "حسبة",
    short_name: "حسبة",
    description: "متتبع التغذية الذكي",
    lang: "ar",
    dir: "rtl",
    // The app is served at the origin root (no basePath in next.config.ts).
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f9ff",
    theme_color: "#f8f9ff",
    icons: [
      { src: "/icons/hesbah-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/hesbah-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/hesbah-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
