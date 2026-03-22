import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "S5Evo Portal – Mannschaftsanmeldung",
  description: "Mannschaftsfünfkampf Anmeldung & Verwaltung",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={cn("font-sans", geist.variable)}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
