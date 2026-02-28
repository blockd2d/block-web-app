import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Block — Territory + Sales Ops',
    short_name: 'Block',
    description:
      'Territory clustering, rep assignments, field outcomes, messaging, contracts, and job completion for door-to-door teams.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    orientation: 'any',
    icons: [
      { src: '/block-logo-icon.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/block-logo-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
