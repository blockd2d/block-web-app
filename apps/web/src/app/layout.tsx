import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  icons: {
    icon: '/block-logo-icon.png',
    apple: '/block-logo-icon.png',
  },
  title: {
    default: "Block — Territory + Sales Ops",
    template: "%s · Block",
  },
  description:
    "Block is a territory and sales operations platform for door-to-door teams: clustering, assignments, analytics, messaging, contracts, and job completion.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000"),
  keywords: [
    "territory clustering",
    "door-to-door",
    "pressure washing CRM",
    "field sales ops",
    "route planning",
    "sales rep tracking",
    "SMS messaging hub",
  ],
  openGraph: {
    title: "Block — Territory + Sales Ops",
    description:
      "Territory clustering, rep assignments, field outcomes, messaging, contracts, and labor job completion — built for door-to-door teams.",
    type: "website",
    siteName: "Block",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Block — Territory + Sales Ops",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Block — Territory + Sales Ops",
    description:
      "Territory clustering, rep assignments, messaging, analytics, contracts, and job completion — built for door-to-door and pressure washing teams.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var isDev=typeof location!=='undefined'&&(location.hostname==='localhost'||location.hostname==='127.0.0.1');if(isDev&&'serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){r.unregister();});});}})();`,
          }}
        />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(typeof window==='undefined'||!('serviceWorker' in navigator))return;if(window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')return;navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(function(){});})();`,
          }}
        />
      </body>
    </html>
  );
}
