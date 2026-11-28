import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { Toaster } from "@/components/layout/toaster";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "SmartBook", template: "%s · SmartBook" },
  description: "Book rooms in the AAU Klagenfurt Nordtrakt — with live occupancy so ghost bookings get freed up.",
};

export const viewport: Viewport = { themeColor: "#1B263B" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
