import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "./providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import RoleSimulationBanner from "./components/role-simulation-banner";
import LayoutWrapper from "./components/layout-wrapper";
import PwaServiceWorker from "./components/pwa-service-worker";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  applicationName: "S5Evo Portal",
  title: "S5Evo Portal – Mannschaftsfünfkampf",
  description: "Mannschaftsfünfkampf Anmeldung, Verwaltung & Mission Control",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "S5Evo Portal",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#c8102e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <TooltipProvider>
            <RoleSimulationBanner />
            <LayoutWrapper>{children}</LayoutWrapper>
            <PwaServiceWorker />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
