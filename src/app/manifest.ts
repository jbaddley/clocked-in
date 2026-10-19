import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clocked In",
    short_name: "Clocked In",
    description: "Log volunteer hours, value them for grants, and report on impact.",
    start_url: "/",
    display: "standalone",
    background_color: "#001836",
    theme_color: "#001836",
    icons: [
      { src: "/favicon/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/favicon/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
