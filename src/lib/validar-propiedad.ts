import type { DatosPropiedad, Estado } from './propiedades';
import { slugificar } from './propiedades';

// Validación de lo que manda el formulario del panel. Vive aparte de las
// rutas porque la usan tanto crear como actualizar, y así las dos aplican
// exactamente los mismos límites.

const TIPOS = ['departamento', 'casa', 'oficina'] as const;
const OPERACIONES = ['venta', 'arriendo'] as const;
const MONEDAS = ['UF', 'CLP'] as const;
const ESTADOS = ['BORRADOR', 'PUBLICADA'] as const;
const TONOS = ['dia', 'atardecer'] as const;

export type Resultado = { ok: true; datos: DatosPropiedad } | { ok: false; error: string };

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Entero no negativo; devuelve NaN si lo que llega no sirve. */
function entero(v: unknown, max: number): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  if (!Number.isFinite(n) || n < 0 || n > max) return Number.NaN;
  return Math.trunc(n);
}

/** Igual que entero, pero vacío significa "sin dato" en vez de error. */
function opcional(v: unknown, max: number): number | null | undefined {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = entero(v, max);
  return Number.isNaN(n) ? undefined : n;
}

function listaTexto(v: unknown, maxItems: number, maxLargo: number): string[] {
  const bruto = Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : [];
  return bruto
    .map((x) => texto(x, maxLargo))
    .filter(Boolean)
    .slice(0, maxItems);
}

const esFecha = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export function validarPropiedad(body: Record<string, unknown>): Resultado {
  const tipo = texto(body.tipo, 20);
  if (!TIPOS.includes(tipo as (typeof TIPOS)[number])) return { ok: false, error: 'Elige el tipo de propiedad' };

  const operacion = texto(body.operacion, 20);
  if (!OPERACIONES.includes(operacion as (typeof OPERACIONES)[number])) return { ok: false, error: 'Elige si es venta o arriendo' };

  const comuna = texto(body.comuna, 60);
  if (!comuna) return { ok: false, error: 'Escribe la comuna' };

  const precioMoneda = texto(body.precioMoneda, 5);
  if (!MONEDAS.includes(precioMoneda as (typeof MONEDAS)[number])) return { ok: false, error: 'Elige la moneda del precio' };

  const precioValor = entero(body.precioValor, 1_000_000_000);
  if (Number.isNaN(precioValor) || precioValor < 1) return { ok: false, error: 'Escribe un precio válido' };

  const estado = texto(body.estado, 20) || 'BORRADOR';
  if (!ESTADOS.includes(estado as (typeof ESTADOS)[number])) return { ok: false, error: 'El estado no es válido' };

  const ilustracionTono = texto(body.ilustracionTono, 20) || 'dia';
  if (!TONOS.includes(ilustracionTono as (typeof TONOS)[number])) return { ok: false, error: 'El tono de la ilustración no es válido' };

  const publicada = texto(body.publicada, 10);
  if (!esFecha(publicada)) return { ok: false, error: 'Escribe la fecha de publicación como AAAA-MM-DD' };

  // El slug es la URL pública: si no viene, se arma del tipo, la comuna y el sector.
  const slug = slugificar(texto(body.slug, 120) || `${tipo}-${comuna}-${texto(body.sector, 60)}`);
  if (slug.length < 3) return { ok: false, error: 'El enlace de la propiedad quedó vacío' };

  const numeros = {
    dormitorios: entero(body.dormitorios, 50),
    banos: entero(body.banos, 50),
    estacionamientos: entero(body.estacionamientos, 50),
    bodegas: entero(body.bodegas, 50),
    superficieUtil: entero(body.superficieUtil, 100_000),
    superficieTotal: entero(body.superficieTotal, 100_000),
    anio: entero(body.anio, 2200),
  };
  for (const [campo, valor] of Object.entries(numeros)) {
    if (Number.isNaN(valor)) return { ok: false, error: `Revisa el campo ${campo}: tiene que ser un número` };
  }

  const terreno = opcional(body.terreno, 1_000_000);
  const piso = opcional(body.piso, 300);
  const gastosComunes = opcional(body.gastosComunes, 100_000_000);
  if (terreno === undefined || piso === undefined || gastosComunes === undefined) {
    return { ok: false, error: 'Revisa terreno, piso o gastos comunes: tienen que ser números o quedar vacíos' };
  }

  const resumen = texto(body.resumen, 300);
  if (!resumen) return { ok: false, error: 'Escribe el resumen que se ve en la tarjeta' };

  return {
    ok: true,
    datos: {
      slug,
      titulo: texto(body.titulo, 160),
      tipo: tipo as DatosPropiedad['tipo'],
      operacion: operacion as DatosPropiedad['operacion'],
      comuna,
      sector: texto(body.sector, 80),
      precioValor,
      precioMoneda: precioMoneda as 'UF' | 'CLP',
      ...numeros,
      terreno,
      piso,
      gastosComunes,
      orientacion: texto(body.orientacion, 40),
      etiquetas: listaTexto(body.etiquetas, 8, 60),
      resumen,
      descripcion: listaTexto(body.descripcion, 40, 2000),
      caracteristicas: listaTexto(body.caracteristicas, 40, 120),
      destacada: body.destacada === true || body.destacada === 'true' || body.destacada === 'on',
      publicada,
      estado: estado as Estado,
      ilustracionSeed: Number.isNaN(entero(body.ilustracionSeed, 999)) ? 1 : entero(body.ilustracionSeed, 999),
      ilustracionTono: ilustracionTono as 'dia' | 'atardecer',
    },
  };
}
