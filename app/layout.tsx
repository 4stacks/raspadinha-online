import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegistration } from "@/components/pwa-registration";

export const metadata: Metadata = {
  title: "Sorte de Casa — raspadinha promocional",
  description: "Raspe, descubra e resgate brindes promocionais.",
  applicationName: "Sorte de Casa",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sorte de Casa",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#f4f1e9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
