import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mordomia",
  description: "Os restaurantes onde foste e os que queres experimentar, com amigos.",
  appleWebApp: { capable: true, title: "Mordomia", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "only light",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-PT"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* The bottom bar on every screen but the map (it reads the address, hence the Suspense). */}
        <Suspense>
          <AppNav />
        </Suspense>
      </body>
    </html>
  );
}
