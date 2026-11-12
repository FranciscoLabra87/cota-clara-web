import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

// ─── Cabeceras de seguridad ───
//
// Van acá y no en un middleware porque en Next 16 el middleware se llama
// proxy.ts y exige runtime Node, que OpenNext solo soporta de forma
// experimental y sin mantención oficial. No vale colgar el deploy de eso.
//
// La consecuencia es que no hay nonce por request: Next inyecta el payload RSC
// en scripts inline, así que script-src necesita 'unsafe-inline'. La CSP igual
// sirve para lo que más importa acá, que es bloquear scripts de terceros,
// iframes ajenos y envíos de formulario fuera del sitio.

// HSTS y upgrade-insecure-requests solo cuando se despliega de verdad. En
// localhost dejarían el origen pineado a https y romperían cualquier otro
// servidor local por http.
//
// WORKERS_CI=1 lo pone Cloudflare Workers Builds en cada build suyo, así que
// el sitio sale con HSTS sin que nadie tenga que acordarse de una variable en
// el panel. COTA_HSTS queda para forzarlo a mano desde otro lado.
const enProduccion = process.env.COTA_HSTS === '1' || process.env.WORKERS_CI === '1';

// React usa eval() en modo desarrollo para reconstruir stacks y para el Fast
// Refresh. Sin esto la consola se llena de errores al trabajar en local. En
// producción React nunca lo usa, así que el permiso no sale del build de dev.
const esDesarrollo = process.env.NODE_ENV !== 'production';
const evalDeDesarrollo = esDesarrollo ? " 'unsafe-eval'" : '';

const TURNSTILE = 'https://challenges.cloudflare.com';

const CSP_PAGINAS = [
  "default-src 'self'",
  // 'unsafe-inline': ver el comentario de arriba. Turnstile carga su widget.
  `script-src 'self' 'unsafe-inline'${evalDeDesarrollo} ${TURNSTILE}`,
  // Los atributos style= que emite React caen acá.
  "style-src 'self' 'unsafe-inline'",
  // Las tipografías son locales (next/font/local), no hay CDN de fuentes.
  "font-src 'self'",
  // Las teselas del mapa se descargan solo cuando el usuario llega a esa sección.
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  `connect-src 'self' ${TURNSTILE}`,
  `frame-src ${TURNSTILE}`,
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'",
  ...(enProduccion ? ['upgrade-insecure-requests'] : []),
].join('; ');

// Las respuestas de la API no cargan ni ejecutan nada.
const CSP_API = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; sandbox";

const comunes = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  ...(enProduccion
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { formats: ['image/avif', 'image/webp'] },

  async headers() {
    return [
      {
        source: '/api/:ruta*',
        headers: [
          ...comunes,
          { key: 'Content-Security-Policy', value: CSP_API },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          // Nada de la API debería quedar en una caché compartida.
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      {
        // Todo menos la API, que ya quedó cubierta arriba; si no, saldrían dos
        // cabeceras Content-Security-Policy y manda la más restrictiva.
        source: '/:ruta((?!api/).*)',
        headers: [
          ...comunes,
          { key: 'Content-Security-Policy', value: CSP_PAGINAS },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;

// Deja los bindings de Cloudflare (D1) disponibles durante `next dev`, contra
// una base local en .wrangler/state. Sin esto, getCloudflareContext() falla al
// desarrollar.
initOpenNextCloudflareForDev();
