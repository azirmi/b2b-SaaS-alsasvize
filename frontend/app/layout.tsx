import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alsas Loren Müşteri İşlem Paneli",
  description:
    "Danışmanınız tarafından başlatılan vize sürecinizi takip etmek, belgelerinizi güvenli şekilde yüklemek ve gerekli adımları tamamlamak için panelinize giriş yapın.",
  openGraph: {
    title: "Alsas Loren Müşteri İşlem Paneli",
    description:
      "Danışmanınız tarafından başlatılan vize sürecinizi takip etmek, belgelerinizi güvenli şekilde yüklemek ve gerekli adımları tamamlamak için panelinize giriş yapın.",
    type: "website",
  },
  icons: {
    icon: "/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full w-full overflow-x-hidden antialiased`}
    >
      <body className="min-h-full w-full max-w-full overflow-x-hidden flex flex-col bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
