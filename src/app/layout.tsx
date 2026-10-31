import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { LAYOUT } from "@/lib/ask/layout";

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
    <html
      lang="en"
      data-layout={LAYOUT}
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pt-[env(safe-area-inset-top)] frame:bg-[#dde7e1]">
        {/* On a laptop, the app sits in a phone-width column (src/lib/ask/layout.ts). */}
        <div className="flex w-full flex-1 flex-col frame:mx-auto frame:max-w-md frame:bg-background frame:shadow-[0_0_0_1px_rgba(14,42,32,0.06),0_24px_64px_-24px_rgba(14,42,32,0.3)]">
          {children}
        </div>
        {/* Top, so a toast never covers the bottom buttons or the tab bar. */}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
