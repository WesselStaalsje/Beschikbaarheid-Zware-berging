import type { Metadata } from "next";
import "./globals.css";
import { PwaRegister } from "./pwa-register";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#101820",
};

export const metadata: Metadata = {
  title: "Plusdiensten | Zware Berging",
  description: "Actuele beschikbaarheid van Plusbergers per vestiging.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Plusdiensten",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon-192.png",
    shortcut: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className="antialiased"><PwaRegister />{children}</body>
    </html>
  );
}
