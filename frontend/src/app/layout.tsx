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

import type { Viewport } from "next";
export const viewport: Viewport = {
  themeColor: "#080808",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "PhishingScanner",
  description: "Escanea enlaces sospechosos o imágenes en segundos con PhishingScanner",
  appleWebApp: {
    capable: true,
    title: "PhishingScan",
    statusBarStyle: "black-translucent",
  },
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
  // C-3: Validar el ID de GTM antes de inyectarlo en dangerouslySetInnerHTML
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const safeGtmId = /^GTM-[A-Z0-9]+$/.test(gtmId ?? '') ? gtmId : null;

  return (
    <html
      lang="es"
      translate="no"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {safeGtmId && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${safeGtmId}');`
            }}
          />
        )}
      </head>
      <body className="min-h-full flex flex-col bg-[#080808]" suppressHydrationWarning>
        {safeGtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${safeGtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
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
