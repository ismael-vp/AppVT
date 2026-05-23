import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PhishingScanner',
    short_name: 'PhishingScan',
    description: 'Escudo inteligente contra el fraude digital y análisis de phishing.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    id: '/',
    scope: '/',
    orientation: 'portrait',
    display_override: ['standalone', 'minimal-ui'],
    categories: ['security', 'utilities'],
    lang: 'es',
    dir: 'ltr',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      }
    ],
    screenshots: [
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        // form_factor: 'wide' -> next.js types might not support form_factor directly, just use standard format
      }
    ]
  };
}
