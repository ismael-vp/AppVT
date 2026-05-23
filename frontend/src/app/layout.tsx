import type { Metadata } from "next";
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
  title: "PhishingScanner",
  description: "Escanea enlaces sospechosos o imágenes en segundos con PhishingScanner",
};

import ServerStatus from "@/components/ui/ServerStatus";
import { ClientAuthProvider } from "@/components/auth/ClientAuthProvider";
import ToastContainer from "@/components/ui/ToastContainer";
import { Header } from "@/components/ui/Header";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      translate="no"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ClientAuthProvider>
          <ServerStatus />
          <ToastContainer />
          <Header />
          {children}
        </ClientAuthProvider>
      </body>
    </html>
  );
}
