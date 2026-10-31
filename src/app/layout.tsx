import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DartAsk",
  description: "Post a small favor, find a classmate who can help, and get things done.",
  icons: { icon: "/dartask-logo.png", apple: "/dartask-logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#f3f6f4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        {/* Top, so a toast never covers the bottom buttons or the tab bar. */}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
