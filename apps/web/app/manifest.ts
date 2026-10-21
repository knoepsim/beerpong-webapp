import type { MetadataRoute } from "next";
import { APP_NAME } from "@/components/brand";

/** Installable as an app (home screen): name, colors and the icons of public/brand. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Turniere organisieren und mitspielen: Anmeldung, Check-in, Spielplan und Ergebnisse an einem Ort.",
    start_url: "/tournaments",
    display: "standalone",
    background_color: "#F5F5F7",
    theme_color: "#7C3AED",
    lang: "de",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
