import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "react-datepicker/dist/react-datepicker.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alsasvize — Vize Operasyonları",
  description:
    "Kurumsal vize başvuru yönetimi: departman havuzları, RBAC, gerçek zamanlı iş akışı ve değiştirilemez denetim kaydı.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
