import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "./providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import RoleSimulationBanner from "./components/role-simulation-banner";
import LayoutWrapper from "./components/layout-wrapper";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "S5Evo Portal – Mannschaftsfünfkampf",
  description: "Mannschaftsfünfkampf Anmeldung, Verwaltung & Mission Control",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <TooltipProvider>
            <RoleSimulationBanner />
            <LayoutWrapper>{children}</LayoutWrapper>
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
