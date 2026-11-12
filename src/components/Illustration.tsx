import type { ReactElement } from 'react';

/**
 * Ilustraciones vectoriales de marca (cielo, cordillera, edificios, planos, mapa).
 * Sirven de reemplazo mientras no haya fotografía real: se generan con una semilla,
 * así que cada propiedad tiene siempre la misma imagen.
 */

export type IllustrationVariant = 'skyline' | 'edificio' | 'casa' | 'oficina' | 'plano' | 'mapa';
export type Tono = 'dia' | 'atardecer';

type Props = {
  variant: IllustrationVariant;
  seed?: number;
  tono?: Tono;
  dormitorios?: number;
  superficie?: number;
  planta?: 'vivienda' | 'oficina';
  etiqueta?: string;
  label?: string;
  className?: string;
};

type Ctx = { uid: string; r: () => number; tono: Tono };

const C = {
  noche: '#061A2A',
  petroleo: '#0B2F4A',
  terracota: '#C65A32',
  hormigon: '#EEECE7',
  hormigonSombra: '#D3D0C9',
  losa: '#2C3338',
  blanco: '#FFFFFF',
  texto: '#55606B',
  arbol: '#1E4744',
  arbol2: '#2B5F5A',
  luz: '#F4CDA5',
};

function rng(seed: number) {
  let a = seed * 9973 + 17;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n1 = (v: number) => Math.round(v * 10) / 10;

function Cielo({ id, tono }: { id: string; tono: Tono }) {
  const stops =
    tono === 'atardecer'
      ? [['0', '#06192A'], ['0.45', '#0B2F4A'], ['0.75', '#2B5878'], ['0.92', '#B6806A'], ['1', '#D69A73']]
      : [['0', '#B4C8D7'], ['0.6', '#DAE4EC'], ['1', '#F1F4F6']];
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      {stops.map(([o, c]) => (
        <stop key={o} offset={o} stopColor={c} />
      ))}
    </linearGradient>
  );
}

function Vidrio({ id, tono, x1, y1, x2, y2 }: { id: string; tono: Tono; x1: number; y1: number; x2: number; y2: number }) {
  const stops =
    tono === 'atardecer'
      ? [['0', '#102E47'], ['0.5', '#7E6670'], ['1', '#102E47']]
      : [['0', '#1C4466'], ['0.48', '#7398B4'], ['0.56', '#557D9C'], ['1', '#1C4466']];
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
      {stops.map(([o, c]) => (
        <stop key={o} offset={o} stopColor={c} />
      ))}
    </linearGradient>
  );
}

function Arbol({ x, base, s, dusk }: { x: number; base: number; s: number; dusk: boolean }) {
  const a = dusk ? '#0B2234' : C.arbol;
  const b = dusk ? '#123049' : C.arbol2;
  return (
    <g>
      <rect x={x - 3 * s} y={base - 34 * s} width={6 * s} height={34 * s} fill={dusk ? '#081B2A' : '#3B3530'} />
      <circle cx={x - 16 * s} cy={base - 44 * s} r={22 * s} fill={a} />
      <circle cx={x + 14 * s} cy={base - 48 * s} r={24 * s} fill={b} />
      <circle cx={x} cy={base - 68 * s} r={26 * s} fill={a} />
    </g>
  );
}

function Skyline({ uid, r, tono }: Ctx) {
  const W = 1600;
  const H = 900;
  const dusk = tono === 'atardecer';
  const ridge = (base: number, amp: number, step: number) => {
    const pts: [number, number][] = [];
    for (let x = -40; x <= W + 40; x += step) pts.push([x, base - r() * amp]);
    return pts;
  };
  const back = ridge(470, 170, 85);
  const front = ridge(585, 95, 64);
  const area = (pts: [number, number][]) =>
    `M${pts[0][0]},${H} ` + pts.map(([x, y]) => `L${x},${n1(y)}`).join(' ') + ` L${pts[pts.length - 1][0]},${H} Z`;

  const caps: string[] = [];
  for (let i = 1; i < back.length - 1; i++) {
    const [x, y] = back[i];
    const [lx, ly] = back[i - 1];
    const [rx, ry] = back[i + 1];
    if (y < ly && y < ry && y < 405) {
      const k = 0.34;
      const ax = x + (lx - x) * k;
      const ay = y + (ly - y) * k;
      const bx = x + (rx - x) * k;
      const by = y + (ry - y) * k;
      const chord = (t: number) => ay + (by - ay) * t;
      const m1x = ax + (bx - ax) * 0.33;
      const m2x = ax + (bx - ax) * 0.66;
      caps.push(
        `M${n1(ax)},${n1(ay)} L${x},${n1(y)} L${n1(bx)},${n1(by)} L${n1(m2x)},${n1(chord(0.66) + 3)} L${n1(m1x)},${n1(chord(0.33) + 11)} Z`,
      );
    }
  }

  const edificios: ReactElement[] = [];
  const ventanas: string[] = [];
  let x = -20;
  while (x < W + 20) {
    const w = 36 + Math.floor(r() * 64);
    const alto = x > 880 && x < 1320 ? 1.25 : 1;
    const h = Math.floor((120 + r() * 200) * alto);
    const top = H - h;
    const tonoEdificio = dusk ? (r() > 0.5 ? '#0E2C44' : '#123653') : r() > 0.5 ? '#557389' : '#64809A';
    edificios.push(<rect key={x} x={x} y={top} width={w} height={h} fill={tonoEdificio} />);
    if (dusk) {
      for (let wy = top + 14; wy < H - 40; wy += 16) {
        for (let wx = x + 7; wx < x + w - 9; wx += 12) {
          if (r() < 0.1) ventanas.push(`M${wx},${wy}h5v7h-5z`);
        }
      }
    }
    x += w + Math.floor(r() * 4);
  }
  const tx = 1130;

  return (
    <>
      <defs>
        <Cielo id={`${uid}-cielo`} tono={tono} />
        <radialGradient id={`${uid}-sol`} cx="0.7" cy="0.7" r="0.5">
          <stop offset="0" stopColor="#E08A5C" stopOpacity={dusk ? 0.5 : 0.2} />
          <stop offset="1" stopColor="#E08A5C" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-bruma`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor={C.noche} stopOpacity="0" />
          <stop offset="1" stopColor={C.noche} stopOpacity={dusk ? 0.7 : 0.3} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${uid}-cielo)`} />
      <rect width={W} height={H} fill={`url(#${uid}-sol)`} />
      <path d={area(back)} fill={dusk ? '#2A4F6E' : '#8EA8BC'} />
      <path d={caps.join(' ')} fill="#EEF2F5" opacity={dusk ? 0.88 : 1} />
      <path d={area(front)} fill={dusk ? '#173B57' : '#6F8DA4'} />
      {edificios}
      <path d={`M${tx},${H} V372 L${tx + 22},318 L${tx + 74},336 V${H} Z`} fill={dusk ? '#0F2E47' : '#48667E'} />
      <path d={`M${tx + 40},${H} V327 L${tx + 74},336 V${H} Z`} fill={dusk ? '#174362' : '#5F7E96'} />
      {ventanas.length > 0 ? <path d={ventanas.join('')} fill={C.luz} opacity="0.75" /> : null}
      <rect width={W} height={H} fill={`url(#${uid}-bruma)`} />
    </>
  );
}

function Edificio({ uid, r, tono }: Ctx) {
  const dusk = tono === 'atardecer';
  const suelo = 500;
  const top = 60 + Math.floor(r() * 80);
  const L = 180 + Math.floor(r() * 80);
  const ancho = 280 + Math.floor(r() * 90);
  const R = L + ancho;
  const lado = 48 + Math.floor(r() * 24);
  const fachada = ['#EEECE7', '#E5E0D6', '#F4F2EE', '#DAD3C7'][Math.floor(r() * 4)];
  const cols = ancho > 330 ? 5 : 4;
  const colW = (R - L - 24) / cols;
  const pisoH = 44;
  const pisos = Math.floor((suelo - 64 - top) / pisoH);
  const vidrio = `url(#${uid}-vidrio)`;
  const fondo = [
    { x: 10 + r() * 60, w: 90 + r() * 80, h: 170 + r() * 150 },
    { x: 130 + r() * 50, w: 70 + r() * 50, h: 120 + r() * 110 },
    { x: 590 + r() * 70, w: 110 + r() * 80, h: 200 + r() * 140 },
  ];
  const filas: ReactElement[] = [];
  for (let i = 0; i < pisos; i++) {
    const y = top + 16 + i * pisoH;
    const encendida = dusk && r() < 0.55;
    filas.push(
      <g key={i}>
        <rect x={L + 12} y={y} width={R - L - 24} height={26} fill={vidrio} />
        {encendida ? <rect x={n1(L + 12 + Math.floor(r() * cols) * colW)} y={y} width={n1(colW)} height={26} fill={C.luz} opacity={0.6} /> : null}
        <rect x={L + 8} y={y + 13} width={R - L - 16} height={13} fill="#FFFFFF" opacity={0.2} />
        <path d={`M${L + 8} ${y + 13}H${R - 8}`} stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={1.5} />
        <rect x={L + 4} y={y + 26} width={R - L - 8} height={5} fill={C.blanco} />
        <path
          d={`M${R + 8} ${y + 4} L${R + lado - 8} ${y + 16} V${y + 36} L${R + 8} ${y + 24} Z`}
          fill={dusk ? '#0F2B42' : '#3E6380'}
          opacity={0.85}
        />
      </g>,
    );
  }
  const columnas = Array.from({ length: cols + 1 }, (_, k) => `M${n1(L + 12 + k * colW)},${top + 16}V${suelo - 64}`).join(' ');
  const toldo = L + 24 + Math.floor(r() * 40);
  const arboles = [
    { x: L - 70 + r() * 40, s: 1 + r() * 0.35 },
    { x: R + lado + 20 + r() * 30, s: 1.05 + r() * 0.35 },
    { x: R + lado + 100 + r() * 40, s: 0.8 + r() * 0.3 },
  ];

  return (
    <>
      <defs>
        <Cielo id={`${uid}-cielo`} tono={tono} />
        <Vidrio id={`${uid}-vidrio`} tono={tono} x1={L} y1={top} x2={R} y2={suelo} />
      </defs>
      <rect x="-200" y="-100" width="1200" height="760" fill={`url(#${uid}-cielo)`} />
      <g fill={dusk ? '#143A57' : '#C3D1DB'}>
        {fondo.map((b) => (
          <rect key={b.x} x={n1(b.x)} y={n1(suelo + 10 - b.h)} width={n1(b.w)} height={n1(b.h)} />
        ))}
      </g>
      <rect x={L - 6} y={top - 8} width={R - L + 12} height={10} fill="#DAD7D0" />
      <rect x={L} y={top} width={R - L} height={suelo - top} fill={fachada} />
      <path d={`M${R},${top} L${R + lado},${top + 14} V${suelo} H${R} Z`} fill={C.hormigonSombra} />
      {filas}
      <path d={columnas} stroke={fachada} strokeWidth={3} />
      <rect x={L + 12} y={suelo - 52} width={R - L - 24} height={52} fill={vidrio} />
      <rect x={toldo} y={suelo - 59} width={170} height={7} fill={C.terracota} />
      <path d={`M${toldo + 85},${suelo - 52}V${suelo}`} stroke={fachada} strokeWidth={3} />
      <rect x="-200" y={suelo} width="1200" height="200" fill={dusk ? '#0A2236' : '#D8D5CE'} />
      <rect x="-200" y={suelo} width="1200" height="8" fill={dusk ? '#0F2C43' : '#E7E4DD'} />
      {arboles.map((a) => (
        <Arbol key={a.x} x={n1(a.x)} base={suelo + 6} s={n1(a.s)} dusk={dusk} />
      ))}
    </>
  );
}

function Casa({ uid, r, tono }: Ctx) {
  const dusk = tono === 'atardecer';
  const suelo = 486;
  const vidrio = `url(#${uid}-vidrio)`;
  const listones = Array.from({ length: 11 }, (_, i) => `M${556 + i * 11},205V318`).join(' ');
  const luz = dusk && r() < 0.9;
  return (
    <>
      <defs>
        <Cielo id={`${uid}-cielo`} tono={tono} />
        <Vidrio id={`${uid}-vidrio`} tono={tono} x1={160} y1={200} x2={560} y2={486} />
      </defs>
      <rect x="-200" y="-100" width="1200" height="760" fill={`url(#${uid}-cielo)`} />
      <path d="M-200 380 C 40 300, 200 330, 360 290 S 700 250, 1000 330 V600 H-200 Z" fill={dusk ? '#16405F' : '#AFC3D1'} />
      <path d="M-200 420 C 120 370, 380 400, 560 370 S 860 360, 1000 400 V600 H-200 Z" fill={dusk ? '#11344F' : '#9DB3C2'} />
      <rect x="-200" y={suelo} width="1200" height="200" fill={dusk ? '#0E2A3F' : '#B9C7B6'} />
      <path d="M446 486 H476 L510 600 H410 Z" fill={dusk ? '#163852' : '#DAD7CF'} />
      <rect x="150" y="318" width="430" height="168" fill="#F4F2EE" />
      <rect x="250" y="196" width="430" height="122" fill={C.hormigon} />
      <rect x="548" y="205" width="132" height="113" fill={C.terracota} opacity={0.92} />
      <path d={listones} stroke="#000000" strokeOpacity={0.12} strokeWidth={1.5} />
      <rect x="268" y="214" width="262" height="86" fill={vidrio} />
      <path d="M355 214V300M443 214V300" stroke={C.hormigon} strokeWidth={3} />
      <rect x="168" y="338" width="230" height="148" fill={vidrio} />
      <path d="M245 338V486M322 338V486" stroke="#F4F2EE" strokeWidth={3} />
      {luz ? <rect x="168" y="338" width="153" height="148" fill={C.luz} opacity={0.5} /> : null}
      <rect x="430" y="360" width="56" height="126" fill={C.losa} />
      <rect x="505" y="352" width="56" height="70" fill={vidrio} />
      <rect x="138" y="310" width="454" height="9" fill={C.losa} />
      <rect x="240" y="188" width="452" height="9" fill={C.losa} />
      <rect x="40" y="452" width="100" height="34" fill={C.hormigonSombra} />
      <rect x="600" y="452" width="160" height="34" fill={C.hormigonSombra} />
      <Arbol x={90} base={suelo} s={1.4} dusk={dusk} />
      <Arbol x={720} base={suelo} s={1.2} dusk={dusk} />
    </>
  );
}

function Oficina({ uid, r, tono }: Ctx) {
  const dusk = tono === 'atardecer';
  const suelo = 500;
  const vidrio = `url(#${uid}-vidrio)`;
  const verticales = Array.from({ length: 9 }, (_, i) => `M${300 + (i + 1) * 21},34V440`).join(' ');
  const horizontales = Array.from({ length: 18 }, (_, i) => `M300,${56 + i * 22}H510`).join(' ');
  const luces: string[] = [];
  if (dusk) {
    for (let fy = 56; fy < 430; fy += 22) {
      for (let fx = 300; fx < 510; fx += 21) if (r() < 0.22) luces.push(`M${fx + 2},${fy + 3}h17v16h-17z`);
    }
  }
  const ventanasVecino = Array.from({ length: 24 }, (_, i) => `M${104 + (i % 6) * 26},${248 + Math.floor(i / 6) * 52}h16v30h-16z`).join(' ');
  return (
    <>
      <defs>
        <Cielo id={`${uid}-cielo`} tono={tono} />
        <Vidrio id={`${uid}-vidrio`} tono={tono} x1={300} y1={34} x2={510} y2={500} />
      </defs>
      <rect x="-200" y="-100" width="1200" height="760" fill={`url(#${uid}-cielo)`} />
      <g fill={dusk ? '#143A57' : '#C3D1DB'}>
        <rect x="560" y="180" width="200" height="330" />
        <rect x="20" y="300" width="80" height="210" />
      </g>
      <rect x="90" y="230" width="170" height="270" fill={C.hormigon} />
      <path d={ventanasVecino} fill={dusk ? '#163A55' : '#4F7592'} />
      <rect x="300" y="34" width="210" height="466" fill={vidrio} />
      <path d="M510,34 L552,58 V500 H510 Z" fill={dusk ? '#0C2639' : '#2E5470'} />
      {luces.length > 0 ? <path d={luces.join('')} fill={C.luz} opacity={0.6} /> : null}
      <path d={`${verticales} ${horizontales}`} stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={1.2} />
      <rect x="296" y="26" width="218" height="10" fill={C.hormigon} />
      <rect x="250" y="440" width="330" height="60" fill={C.hormigon} />
      <rect x="360" y="452" width="90" height="48" fill={vidrio} />
      <rect x="350" y="446" width="110" height="6" fill={C.terracota} />
      <rect x="-200" y={suelo} width="1200" height="200" fill={dusk ? '#0A2236' : '#D8D5CE'} />
      <Arbol x={200} base={suelo + 4} s={0.9} dusk={dusk} />
      <Arbol x={640} base={suelo + 4} s={1.1} dusk={dusk} />
    </>
  );
}

type Recinto = { x: number; y: number; w: number; h: number; nombre: string; cama?: boolean };

function Plano({ uid, dormitorios = 3, superficie = 90, planta = 'vivienda' }: { uid: string; dormitorios?: number; superficie?: number; planta?: 'vivienda' | 'oficina' }) {
  const X0 = 96;
  const Y0 = 100;
  const X1 = 704;
  const Y1 = 446;
  const ancho = X1 - X0;
  const alto = Y1 - Y0;
  let recintos: Recinto[];
  if (planta === 'oficina') {
    recintos = [
      { x: X0, y: Y0, w: 380, h: alto, nombre: 'Planta libre' },
      { x: X0 + 380, y: Y0, w: 228, h: 150, nombre: 'Sala de reuniones' },
      { x: X0 + 380, y: Y0 + 150, w: 120, h: 96, nombre: 'Kitchenette' },
      { x: X0 + 500, y: Y0 + 150, w: 108, h: 96, nombre: 'Baños' },
      { x: X0 + 380, y: Y0 + 246, w: 228, h: alto - 246, nombre: 'Recepción' },
    ];
  } else {
    const n = Math.min(Math.max(dormitorios, 1), 4);
    const hDorm = alto / n;
    recintos = [
      { x: X0, y: Y0, w: 190, h: 140, nombre: 'Cocina' },
      { x: X0 + 190, y: Y0, w: 120, h: 140, nombre: 'Baño' },
      { x: X0, y: Y0 + 140, w: 310, h: alto - 140, nombre: 'Living-comedor' },
      ...Array.from({ length: n }, (_, i) => ({
        x: X0 + 310,
        y: Y0 + i * hDorm,
        w: ancho - 310,
        h: hDorm,
        nombre: i === 0 ? 'Dorm. principal' : `Dorm. ${i + 1}`,
        cama: true,
      })),
    ];
  }
  const total = ancho * alto;
  return (
    <>
      <defs>
        <pattern id={`${uid}-grilla`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#E7ECF0" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="-800" y="-560" width="2400" height="1680" fill="#FFFFFF" />
      <rect x="-800" y="-560" width="2400" height="1680" fill={`url(#${uid}-grilla)`} />
      <g style={{ fontFamily: 'var(--ff-display)' }}>
        <g stroke={C.petroleo} strokeWidth={1.5}>
          <path d={`M${X0},62H${X1}`} />
          <path d={`M${X0 - 7},69L${X0 + 7},55M${X1 - 7},69L${X1 + 7},55`} />
        </g>
        <rect x={400 - 92} y="38" width="10" height="10" fill={C.terracota} />
        <text x={400 - 76} y="48" fontSize="13" fontWeight="600" fill={C.petroleo} letterSpacing="1">
          {`${superficie} M² ÚTILES`}
        </text>
        {recintos.map((rc) => {
          const cx = rc.x + rc.w / 2;
          const cy = rc.y + rc.h / 2;
          const m2 = Math.round(((rc.w * rc.h) / total) * superficie);
          return (
            <g key={rc.nombre}>
              <rect x={rc.x} y={rc.y} width={rc.w} height={rc.h} fill="#FFFFFF" stroke={C.petroleo} strokeWidth={3} />
              {rc.cama && rc.h > 100 ? (
                <rect x={cx - 34} y={rc.y + rc.h - 70} width={68} height={54} rx={3} fill="#EEF3F7" stroke="#C5D2DC" />
              ) : null}
              <text x={cx} y={rc.cama && rc.h > 100 ? cy - 18 : cy - 2} textAnchor="middle" fontSize="15" fontWeight="600" fill={C.petroleo}>
                {rc.nombre}
              </text>
              <text x={cx} y={(rc.cama && rc.h > 100 ? cy - 18 : cy - 2) + 18} textAnchor="middle" fontSize="12.5" fill={C.texto}>
                {`${m2} m²`}
              </text>
            </g>
          );
        })}
        {planta === 'vivienda' ? (
          <g>
            <rect x={X0} y={Y1} width={310} height={46} fill="none" stroke={C.petroleo} strokeWidth={2} strokeDasharray="7 6" />
            <text x={X0 + 155} y={Y1 + 28} textAnchor="middle" fontSize="13" fill={C.texto}>
              Terraza
            </text>
          </g>
        ) : null}
        <rect x={X0} y={Y0} width={ancho} height={alto} fill="none" stroke={C.petroleo} strokeWidth={7} />
        <g transform="translate(748 500)">
          <circle r="17" fill="#FFFFFF" stroke={C.petroleo} strokeWidth={1.5} />
          <path d="M0 -11 L5 4 L0 1 L-5 4 Z" fill={C.petroleo} />
          <text y="31" textAnchor="middle" fontSize="11" fontWeight="600" fill={C.petroleo}>
            N
          </text>
        </g>
      </g>
    </>
  );
}

function Mapa({ uid, r, etiqueta = 'Propiedad' }: Ctx & { etiqueta?: string }) {
  const manzanas: ReactElement[] = [];
  for (let gx = -96; gx < 900; gx += 96) {
    for (let gy = -84; gy < 650; gy += 84) {
      const parque = r() < 0.08;
      manzanas.push(<rect key={`${gx}-${gy}`} x={gx + 10} y={gy + 10} width={76} height={64} rx={3} fill={parque ? '#D3E0D5' : '#E0E5E9'} />);
    }
  }
  const anchoEtiqueta = etiqueta.length * 8.6 + 28;
  return (
    <>
      <rect x="-800" y="-560" width="2400" height="1680" fill="#EEF1F3" />
      {manzanas}
      <path d="M-40 70 C 180 40, 300 120, 480 90 S 760 40, 860 70" stroke="#C9D9E6" strokeWidth={26} fill="none" />
      <path d="M-40 430 L 860 296" stroke="#FFFFFF" strokeWidth={22} />
      <path d="M520 -40 L 466 620" stroke="#FFFFFF" strokeWidth={16} />
      <circle cx="400" cy="280" r="150" fill={C.petroleo} fillOpacity={0.06} stroke={C.petroleo} strokeOpacity={0.35} strokeDasharray="6 6" />
      <g style={{ fontFamily: 'var(--ff-display)' }}>
        {[
          [250, 190],
          [560, 360],
        ].map(([mx, my]) => (
          <g key={`${mx}-${my}`}>
            <circle cx={mx} cy={my} r="11" fill="#FFFFFF" stroke={C.petroleo} strokeWidth={1.5} />
            <text x={mx} y={my + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={C.petroleo}>
              M
            </text>
          </g>
        ))}
        <path d="M400 282 c-22 -26 -34 -44 -34 -60 a34 34 0 0 1 68 0 c0 16 -12 34 -34 60z" fill={C.terracota} />
        <circle cx="400" cy="222" r="12" fill="#FFFFFF" />
        <rect x="446" y="206" width={anchoEtiqueta} height="32" rx="4" fill={C.petroleo} />
        <text x="460" y="227" fontSize="14" fontWeight="600" fill="#FFFFFF">
          {etiqueta}
        </text>
      </g>
    </>
  );
}

export function Illustration({ variant, seed = 1, tono = 'dia', dormitorios, superficie, planta, etiqueta, label, className }: Props) {
  const uid = `il-${variant}-${seed}-${tono}`;
  const r = rng(seed);
  const ctx: Ctx = { uid, r, tono };
  let contenido: ReactElement;
  switch (variant) {
    case 'skyline':
      contenido = <Skyline {...ctx} />;
      break;
    case 'casa':
      contenido = <Casa {...ctx} />;
      break;
    case 'oficina':
      contenido = <Oficina {...ctx} />;
      break;
    case 'plano':
      contenido = <Plano uid={uid} dormitorios={dormitorios} superficie={superficie} planta={planta} />;
      break;
    case 'mapa':
      contenido = <Mapa {...ctx} etiqueta={etiqueta} />;
      break;
    default:
      contenido = <Edificio {...ctx} />;
  }
  const encaje = variant === 'plano' || variant === 'mapa' ? 'xMidYMid meet' : 'xMidYMid slice';
  return (
    <svg
      className={className}
      viewBox={variant === 'skyline' ? '0 0 1600 900' : '0 0 800 560'}
      preserveAspectRatio={encaje}
      xmlns="http://www.w3.org/2000/svg"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {contenido}
    </svg>
  );
}
