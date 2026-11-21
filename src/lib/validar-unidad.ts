import { esEstadoUnidad, type EstadoUnidad } from '@/data/properties';
import type { DatosTipologia, DatosUnidad } from './unidades';

// Límites de las tipologías y las unidades. Vive aparte de las rutas porque lo
// usan crear, editar y el importador, así que los tres aplican lo mismo.
//
// Los ayudantes se repiten en vez de importarse de validar-propiedad.ts: allá
// son privados y las medidas de acá admiten el cero ("sin dato"), que en una
// propiedad sería un error.

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

export const MAX_UNIDADES = 2000;

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Entero entre 0 y `max`; NaN si lo que llega no sirve. */
function entero(v: unknown, max: number): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  if (!Number.isFinite(n) || n < 0 || n > max) return Number.NaN;
  return Math.trunc(n);
}

/** Medida con decimales. Acepta la coma decimal y el vacío, que vale cero. */
function medida(v: unknown, max: number): number {
  if (v === null || v === undefined || String(v).trim() === '') return 0;
  const crudo = typeof v === 'string' ? v.trim().replace(',', '.') : v;
  const n = Number(crudo);
  if (!Number.isFinite(n) || n < 0 || n > max) return Number.NaN;
  return Math.round(n * 100) / 100;
}

/** Id opcional: vacío es null; algo que no es un id es undefined (error). */
function idOpcional(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function validarTipologia(body: Record<string, unknown>): Resultado<DatosTipologia> {
  const codigo = texto(body.codigo, 20);
  if (!codigo) return { ok: false, error: 'Escribe el código de la tipología, por ejemplo 2D/2B' };

  const dormitorios = entero(body.dormitorios, 20);
  const banos = entero(body.banos, 20);
  if (Number.isNaN(dormitorios) || Number.isNaN(banos)) {
    return { ok: false, error: 'Los dormitorios y los baños van en números enteros' };
  }

  const superficieUtil = medida(body.superficieUtil, 100_000);
  const superficieTerraza = medida(body.superficieTerraza, 100_000);
  if (Number.isNaN(superficieUtil) || Number.isNaN(superficieTerraza)) {
    return { ok: false, error: 'Revisa los m² de la tipología: van en números, o vacíos' };
  }

  const orden = entero(body.orden ?? 0, 999);
  if (Number.isNaN(orden)) return { ok: false, error: 'El orden tiene que ser un número' };

  return { ok: true, datos: { codigo, dormitorios, banos, superficieUtil, superficieTerraza, orden } };
}

export function validarUnidad(body: Record<string, unknown>): Resultado<DatosUnidad> {
  const numero = texto(body.numero, 20);
  if (!numero) return { ok: false, error: 'Escribe el número de la unidad' };

  const precioUF = entero(body.precioUF, 1_000_000);
  if (Number.isNaN(precioUF) || precioUF < 1) return { ok: false, error: 'Escribe el precio de la unidad en UF' };

  const tipologiaId = idOpcional(body.tipologiaId);
  if (tipologiaId === undefined) return { ok: false, error: 'La tipología elegida no es válida' };

  const piso = body.piso === null || body.piso === undefined || String(body.piso).trim() === '' ? null : entero(body.piso, 300);
  if (piso !== null && Number.isNaN(piso)) return { ok: false, error: 'El piso tiene que ser un número, o quedar vacío' };

  const superficieUtil = medida(body.superficieUtil, 100_000);
  const superficieTotal = medida(body.superficieTotal, 100_000);
  if (Number.isNaN(superficieUtil) || Number.isNaN(superficieTotal)) {
    return { ok: false, error: 'Revisa los m² de la unidad: van en números, o vacíos' };
  }

  const descuentoPct = medida(body.descuentoPct, 100);
  if (Number.isNaN(descuentoPct)) return { ok: false, error: 'El descuento va en porcentaje, entre 0 y 100' };

  const estacionamientos = entero(body.estacionamientos ?? 0, 20);
  const bodegas = entero(body.bodegas ?? 0, 20);
  if (Number.isNaN(estacionamientos) || Number.isNaN(bodegas)) {
    return { ok: false, error: 'Los estacionamientos y las bodegas van en números enteros' };
  }

  const crudo = body.estado ?? 'disponible';
  if (!esEstadoUnidad(crudo)) return { ok: false, error: 'El estado de la unidad no es válido' };

  return {
    ok: true,
    datos: {
      tipologiaId,
      numero,
      piso,
      orientacion: texto(body.orientacion, 40),
      superficieUtil,
      superficieTotal,
      precioUF,
      descuentoPct,
      estacionamientos,
      bodegas,
      estado: crudo as EstadoUnidad,
    },
  };
}
