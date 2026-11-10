import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Juntos · Finanças a dois",
  description:
    "Organizem as contas, compartilhem os planos e conquistem o futuro juntos.",
  applicationName: "Juntos",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Juntos" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7360df",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
