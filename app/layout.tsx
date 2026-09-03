import type { Metadata } from "next";
import "./globals.css";
import { PwaRegister } from "./pwa-register";
import { ThemeToggle } from "./theme-toggle";

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

const themeScript = `
  try {
    const saved = localStorage.getItem('plusdiensten-theme');
    const theme = saved === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="antialiased"><PwaRegister />{children}<ThemeToggle /></body>
    </html>
  );
}
