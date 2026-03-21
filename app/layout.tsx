import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

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
    <html lang="de">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
