// Genera public/og.png, la vista previa de las páginas al compartirlas (Instagram,
// WhatsApp, LinkedIn). Se corre a mano: `node scripts/og-imagen.mjs`.
// Las tipografías locales son woff2 y satori no las lee, así que baja los TTF de
// Google Fonts, que son las mismas familias.
import { writeFile } from 'node:fs/promises';
import { createElement as h } from 'react';
import { ImageResponse } from 'next/og.js';

const PETROLEO = '#0B2F4A';
const TERRACOTA = '#C65A32';
const BLANCO = '#FFFFFF';
const GRIS = '#E6E6E6';

async function fuente(familia, consulta, nombre, weight, style = 'normal') {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${consulta}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1)' },
  }).then((r) => r.text());
  const url = css.match(/src: url\((https:[^)]+\.ttf)\)/)?.[1];
  if (!url) throw new Error(`No se encontró el TTF de ${familia}`);
  const data = await fetch(url).then((r) => r.arrayBuffer());
  return { name: nombre, data, weight, style };
}

// El símbolo del logo (src/components/Logo.tsx) en variante negativo.
const simbolo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 124 128" width="124" height="128">
  <path d="M98.05 39 A47 47 0 1 0 98.05 81 L76 81 A29 29 0 1 1 76 39 Z" fill="${BLANCO}"/>
  <path d="M56 1v118M1 60h97" fill="none" stroke="${BLANCO}" stroke-width="2.8"/>
  <rect x="98" y="47" width="14" height="14" fill="${TERRACOTA}"/>
</svg>`;
const simboloSrc = `data:image/svg+xml;base64,${Buffer.from(simbolo).toString('base64')}`;

const fuentes = await Promise.all([
  fuente('Montserrat', 'Montserrat:wght@500', 'Montserrat', 500),
  fuente('Montserrat', 'Montserrat:wght@700', 'Montserrat', 700),
  fuente('Source Sans 3', 'Source+Sans+3:ital,wght@1,400', 'Source Sans 3', 400, 'italic'),
]);

const imagen = h(
  'div',
  {
    style: {
      width: '1200px',
      height: '630px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: PETROLEO,
      fontFamily: 'Montserrat',
    },
  },
  h(
    'div',
    { style: { display: 'flex', alignItems: 'center', gap: '36px' } },
    h('img', { src: simboloSrc, width: 124, height: 128 }),
    h('div', { style: { display: 'flex', width: '2px', height: '134px', background: BLANCO, opacity: 0.85 } }),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '18px' } },
      h(
        'div',
        { style: { fontSize: '84px', fontWeight: 700, letterSpacing: '0.05em', color: BLANCO, lineHeight: 1 } },
        'COTA CLARA',
      ),
      h(
        'div',
        { style: { fontSize: '27px', fontWeight: 500, letterSpacing: '0.26em', color: GRIS, lineHeight: 1 } },
        'PATRIMONIO INMOBILIARIO',
      ),
    ),
  ),
  h('div', { style: { display: 'flex', width: '120px', height: '4px', background: TERRACOTA, marginTop: '58px' } }),
  h(
    'div',
    {
      style: {
        fontFamily: 'Source Sans 3',
        fontStyle: 'italic',
        fontSize: '42px',
        color: BLANCO,
        marginTop: '34px',
      },
    },
    'El valor de saber.',
  ),
  h(
    'div',
    { style: { fontSize: '24px', fontWeight: 500, letterSpacing: '0.16em', color: '#8FA6B8', marginTop: '26px' } },
    'CORRETAJE · TASACIONES · ASESORÍA · GESTIÓN PATRIMONIAL',
  ),
);

const respuesta = new ImageResponse(imagen, { width: 1200, height: 630, fonts: fuentes });
await writeFile('public/og.png', Buffer.from(await respuesta.arrayBuffer()));
console.log('public/og.png listo');
