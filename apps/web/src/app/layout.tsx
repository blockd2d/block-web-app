import './globals.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Metadata } from 'next';
import { PosthogInit } from '../ui/posthog-provider';
import { ThemeProvider } from '../ui/theme-provider';

export const metadata: Metadata = {
  title: {
    default: 'Block — Territory + Sales Ops',
    template: '%s · Block'
  },
  description:
    'Block is a territory and sales operations platform for door-to-door teams: clustering, assignments, analytics, messaging, contracts, and job completion.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000'),
  keywords: [
    'territory clustering',
    'door-to-door',
    'pressure washing CRM',
    'field sales ops',
    'route planning',
    'sales rep tracking',
    'SMS messaging hub'
  ],
  openGraph: {
    title: 'Block — Territory + Sales Ops',
    description:
      'Territory clustering, rep assignments, field outcomes, messaging, contracts, and labor job completion — built for door-to-door teams.',
    type: 'website',
    siteName: 'Block',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Block — Territory + Sales Ops'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Block — Territory + Sales Ops',
    description:
      'Territory clustering, rep assignments, messaging, analytics, contracts, and job completion — built for door-to-door and pressure washing teams.',
    images: ['/og.png']
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ThemeProvider>
          <PosthogInit />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
