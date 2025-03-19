import "@/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { Providers } from "@/components/providers/Providers";
import { AppSidebar } from "@/components/layout";

export const metadata: Metadata = {
  title: "P2P Admin Panel",
  description: "Административная панель для управления P2P системой",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${GeistSans.variable}`}>
      <body>
        <Providers>
          <div className="flex min-h-screen">
            <AppSidebar />
            <div className="flex-1 bg-gray-50 dark:bg-slate-950">
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
