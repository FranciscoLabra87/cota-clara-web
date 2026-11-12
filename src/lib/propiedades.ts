import type { Operacion, Propiedad, TipoPropiedad } from '@/data/properties';
import { obtenerDB } from './db';

// Inventario en D1. El sitio público solo ve las PUBLICADA; el panel ve todo.

export type Estado = 'BORRADOR' | 'PUBLICADA';

/** Lo que ve el panel: la propiedad más su id y su estado. */
export type PropiedadAdmin = Propiedad & { id: number; estado: Estado };

type Fila = {
  id: number;
  slug: string;
  tipo: TipoPropiedad;
  operacion: Operacion;
  comuna: string;
  sector: string;
  precio_valor: number;
  precio_moneda: 'UF' | 'CLP';
  precio_periodo: string | null;
  dormitorios: number;
  banos: number;
  estacionamientos: number;
  bodegas: number;
  superficie_util: number;
  superficie_total: number;
  terreno: number | null;
  piso: number | null;
  orientacion: string;
  anio: number;
  gastos_comunes: number | null;
  etiquetas: string;
  resumen: string;
  descripcion: string;
  caracteristicas: string;
  destacada: number;
  publicada: string;
  estado: Estado;
  ilustracion_seed: number;
  ilustracion_tono: 'dia' | 'atardecer';
};

const COLUMNAS = `id, slug, tipo, operacion, comuna, sector, precio_valor, precio_moneda, precio_periodo,
  dormitorios, banos, estacionamientos, bodegas, superficie_util, superficie_total, terreno, piso,
  orientacion, anio, gastos_comunes, etiquetas, resumen, descripcion, caracteristicas,
  destacada, publicada, estado, ilustracion_seed, ilustracion_tono`;

// Las columnas JSON las escribe siempre esta capa, pero si alguna quedara
// malformada vale más una lista vacía que una ficha caída.
function lista(json: string): string[] {
  try {
    const valor = JSON.parse(json);
    return Array.isArray(valor) ? valor.map(String) : [];
  } catch {
    return [];
  }
}

// Fuera de /api/ a propósito: a esas rutas se les aplica una CSP con `sandbox`
// que rompe el visor de imágenes del navegador al abrir la foto directamente.
export const urlFoto = (clave: string) => `/fotos/${clave}`;

function aPropiedad(f: Fila, fotos: string[]): PropiedadAdmin {
  return {
    id: f.id,
    estado: f.estado,
    slug: f.slug,
    tipo: f.tipo,
    operacion: f.operacion,
    comuna: f.comuna,
    sector: f.sector,
    precio: {
      valor: f.precio_valor,
      moneda: f.precio_moneda,
      ...(f.precio_periodo === 'mes' ? { periodo: 'mes' as const } : {}),
    },
    dormitorios: f.dormitorios,
    banos: f.banos,
    estacionamientos: f.estacionamientos,
    bodegas: f.bodegas,
    superficieUtil: f.superficie_util,
    superficieTotal: f.superficie_total,
    ...(f.terreno == null ? {} : { terreno: f.terreno }),
    ...(f.piso == null ? {} : { piso: f.piso }),
    orientacion: f.orientacion,
    anio: f.anio,
    ...(f.gastos_comunes == null ? {} : { gastosComunes: f.gastos_comunes }),
    etiquetas: lista(f.etiquetas),
    resumen: f.resumen,
    descripcion: lista(f.descripcion),
    caracteristicas: lista(f.caracteristicas),
    destacada: !!f.destacada,
    publicada: f.publicada,
    ilustracion: { seed: f.ilustracion_seed, tono: f.ilustracion_tono },
    ...(fotos.length ? { imagenes: fotos } : {}),
  };
}

// Una sola consulta para las fotos de todas las propiedades del listado, en
// vez de una por ficha.
async function fotosPorPropiedad(ids: number[]): Promise<Map<number, string[]>> {
  const mapa = new Map<number, string[]>();
  if (!ids.length) return mapa;

  const db = await obtenerDB();
  const huecos = ids.map(() => '?').join(',');
  const { results } = await db
    .prepare(`SELECT propiedad_id, clave FROM propiedad_fotos WHERE propiedad_id IN (${huecos}) ORDER BY orden, id`)
    .bind(...ids)
    .all<{ propiedad_id: number; clave: string }>();

  for (const fila of results) {
    const actuales = mapa.get(fila.propiedad_id) ?? [];
    actuales.push(urlFoto(fila.clave));
    mapa.set(fila.propiedad_id, actuales);
  }
  return mapa;
}

async function hidratar(filas: Fila[]): Promise<PropiedadAdmin[]> {
  const fotos = await fotosPorPropiedad(filas.map((f) => f.id));
  return filas.map((f) => aPropiedad(f, fotos.get(f.id) ?? []));
}

// ─── Lecturas del sitio público ───

export async function propiedadesPublicadas(): Promise<Propiedad[]> {
  const db = await obtenerDB();
  const { results } = await db
    .prepare(`SELECT ${COLUMNAS} FROM propiedades WHERE estado = 'PUBLICADA' ORDER BY publicada DESC, id DESC`)
    .all<Fila>();
  return hidratar(results);
}

export async function propiedadesDestacadas(): Promise<Propiedad[]> {
  const todas = await propiedadesPublicadas();
  return todas.filter((p) => p.destacada);
}

export async function propiedadPorSlug(slug: string): Promise<Propiedad | null> {
  const db = await obtenerDB();
  const fila = await db
    .prepare(`SELECT ${COLUMNAS} FROM propiedades WHERE slug = ? AND estado = 'PUBLICADA'`)
    .bind(slug)
    .first<Fila>();
  if (!fila) return null;
  return (await hidratar([fila]))[0];
}

export async function slugsPublicados(): Promise<{ slug: string; publicada: string }[]> {
  const db = await obtenerDB();
  const { results } = await db
    .prepare(`SELECT slug, publicada FROM propiedades WHERE estado = 'PUBLICADA' ORDER BY publicada DESC`)
    .all<{ slug: string; publicada: string }>();
  return results;
}

// ─── Lecturas del panel ───

export async function propiedadesDelPanel(): Promise<PropiedadAdmin[]> {
  const db = await obtenerDB();
  const { results } = await db
    .prepare(`SELECT ${COLUMNAS} FROM propiedades ORDER BY actualizado_en DESC, id DESC`)
    .all<Fila>();
  return hidratar(results);
}

/** Con el id de cada foto, que el panel necesita para poder borrarlas. */
export async function fotosDePropiedad(id: number): Promise<{ id: number; url: string }[]> {
  const db = await obtenerDB();
  const { results } = await db
    .prepare(`SELECT id, clave FROM propiedad_fotos WHERE propiedad_id = ? ORDER BY orden, id`)
    .bind(id)
    .all<{ id: number; clave: string }>();
  return results.map((f) => ({ id: f.id, url: urlFoto(f.clave) }));
}

export async function propiedadPorId(id: number): Promise<PropiedadAdmin | null> {
  const db = await obtenerDB();
  const fila = await db.prepare(`SELECT ${COLUMNAS} FROM propiedades WHERE id = ?`).bind(id).first<Fila>();
  if (!fila) return null;
  return (await hidratar([fila]))[0];
}

// ─── Escrituras ───

export type DatosPropiedad = {
  slug: string;
  tipo: TipoPropiedad;
  operacion: Operacion;
  comuna: string;
  sector: string;
  precioValor: number;
  precioMoneda: 'UF' | 'CLP';
  dormitorios: number;
  banos: number;
  estacionamientos: number;
  bodegas: number;
  superficieUtil: number;
  superficieTotal: number;
  terreno: number | null;
  piso: number | null;
  orientacion: string;
  anio: number;
  gastosComunes: number | null;
  etiquetas: string[];
  resumen: string;
  descripcion: string[];
  caracteristicas: string[];
  destacada: boolean;
  publicada: string;
  estado: Estado;
  ilustracionSeed: number;
  ilustracionTono: 'dia' | 'atardecer';
};

// El periodo solo tiene sentido en arriendo; se deriva en vez de pedirlo.
const periodoDe = (d: DatosPropiedad) => (d.operacion === 'arriendo' ? 'mes' : null);

const valores = (d: DatosPropiedad) => [
  d.slug,
  d.tipo,
  d.operacion,
  d.comuna,
  d.sector,
  d.precioValor,
  d.precioMoneda,
  periodoDe(d),
  d.dormitorios,
  d.banos,
  d.estacionamientos,
  d.bodegas,
  d.superficieUtil,
  d.superficieTotal,
  d.terreno,
  d.piso,
  d.orientacion,
  d.anio,
  d.gastosComunes,
  JSON.stringify(d.etiquetas),
  d.resumen,
  JSON.stringify(d.descripcion),
  JSON.stringify(d.caracteristicas),
  d.destacada ? 1 : 0,
  d.publicada,
  d.estado,
  d.ilustracionSeed,
  d.ilustracionTono,
];

export async function crearPropiedad(d: DatosPropiedad): Promise<number> {
  const db = await obtenerDB();
  const fila = await db
    .prepare(
      `INSERT INTO propiedades (
         slug, tipo, operacion, comuna, sector, precio_valor, precio_moneda, precio_periodo,
         dormitorios, banos, estacionamientos, bodegas, superficie_util, superficie_total, terreno, piso,
         orientacion, anio, gastos_comunes, etiquetas, resumen, descripcion, caracteristicas,
         destacada, publicada, estado, ilustracion_seed, ilustracion_tono
       ) VALUES (${valores(d).map(() => '?').join(', ')}) RETURNING id`,
    )
    .bind(...valores(d))
    .first<{ id: number }>();
  return fila!.id;
}

export async function actualizarPropiedad(id: number, d: DatosPropiedad): Promise<void> {
  const db = await obtenerDB();
  await db
    .prepare(
      `UPDATE propiedades SET
         slug = ?, tipo = ?, operacion = ?, comuna = ?, sector = ?, precio_valor = ?, precio_moneda = ?,
         precio_periodo = ?, dormitorios = ?, banos = ?, estacionamientos = ?, bodegas = ?,
         superficie_util = ?, superficie_total = ?, terreno = ?, piso = ?, orientacion = ?, anio = ?,
         gastos_comunes = ?, etiquetas = ?, resumen = ?, descripcion = ?, caracteristicas = ?,
         destacada = ?, publicada = ?, estado = ?, ilustracion_seed = ?, ilustracion_tono = ?,
         actualizado_en = datetime('now')
       WHERE id = ?`,
    )
    .bind(...valores(d), id)
    .run();
}

export async function cambiarEstado(id: number, estado: Estado): Promise<void> {
  const db = await obtenerDB();
  await db
    .prepare(`UPDATE propiedades SET estado = ?, actualizado_en = datetime('now') WHERE id = ?`)
    .bind(estado, id)
    .run();
}

/** Devuelve las claves R2 de las fotos, para borrarlas junto con la ficha. */
export async function eliminarPropiedad(id: number): Promise<string[]> {
  const db = await obtenerDB();
  const { results } = await db
    .prepare(`SELECT clave FROM propiedad_fotos WHERE propiedad_id = ?`)
    .bind(id)
    .all<{ clave: string }>();
  // Las fotos caen por ON DELETE CASCADE; las claves se devuelven para que
  // quien llame borre también los objetos de R2 y no queden huérfanos.
  await db.prepare(`DELETE FROM propiedades WHERE id = ?`).bind(id).run();
  return results.map((f) => f.clave);
}

export async function slugEnUso(slug: string, exceptoId?: number): Promise<boolean> {
  const db = await obtenerDB();
  const fila = exceptoId
    ? await db.prepare(`SELECT id FROM propiedades WHERE slug = ? AND id <> ?`).bind(slug, exceptoId).first()
    : await db.prepare(`SELECT id FROM propiedades WHERE slug = ?`).bind(slug).first();
  return !!fila;
}

export function slugificar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}
