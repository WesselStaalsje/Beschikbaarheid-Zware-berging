import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zware Berging Plusdiensten",
    short_name: "Plusdiensten",
    description: "Actuele status van Plusbergers per vestiging.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef1f4",
    theme_color: "#101820",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
