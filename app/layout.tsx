import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "./providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import CommandPill from "./components/command-pill";
import RoleSwitcher from "./components/role-switcher";
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
            {children}
            <CommandPill />
            <RoleSwitcher />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
