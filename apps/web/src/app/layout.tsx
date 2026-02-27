import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
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
        {/* #region agent log */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var e='http://127.0.0.1:7527/ingest/540497ec-c047-4e2e-832e-74480964fbf6';function send(p){fetch(e,{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2be4af'},body:JSON.stringify(Object.assign({sessionId:'2be4af',timestamp:Date.now()},p))}).catch(function(){});}window.onerror=function(msg,url,line,col,err){send({location:'window.onerror',message:String(msg),data:{url:url,line:line,col:col,stack:err&&err.stack},hypothesisId:'errors'});};window.onunhandledrejection=function(ev){send({location:'unhandledrejection',message:'Unhandled rejection',data:{reason:String(ev.reason&&(ev.reason.message||ev.reason)),stack:ev.reason&&ev.reason.stack},hypothesisId:'errors'});};})();`,
          }}
        />
        {/* #endregion */}
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
