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
  applicationName: "DartAsk",
  icons: { icon: "/dartask-logo.png", apple: "/icons/apple-touch-icon.png" },
  // Added to the home screen, it opens full screen (no Safari bars).
  appleWebApp: { capable: true, title: "DartAsk", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f3f6f4",
  // Draw under the notch and home indicator; screens pad with env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col pt-[env(safe-area-inset-top)]">
        {children}
        {/* Top, so a toast never covers the bottom buttons or the tab bar. */}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
