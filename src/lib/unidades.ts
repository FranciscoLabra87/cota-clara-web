import type { EstadoUnidad, ResumenStock, Tipologia, TipologiaConStock, Unidad } from '@/data/properties';
import { obtenerDB } from './db';
import { medidasDeCodigo, type FilaImportada } from './importar-unidades';

// Stock por unidades de los proyectos nuevos: la única puerta a `tipologias` y
// `unidades`, igual que propiedades.ts lo es para el inventario.
//
// No importa nada de propiedades.ts a propósito: ese módulo sí importa este
// (el listado necesita el resumen del stock), y un ciclo entre los dos deja
// uno de los dos a medio inicializar según quién cargue primero.

export class ErrorUnidad extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Las fotos y los planos se sirven por /fotos/ y no por /api/: a esas rutas se
// les aplica una CSP con `sandbox` que rompe el visor del navegador. Es la
// misma regla de urlFoto() en propiedades.ts, repetida acá para no importarlo.
const urlPlano = (clave: string) => `/fotos/${clave}`;

type FilaTipologia = {
  id: number;
  codigo: string;
  dormitorios: number;
  banos: number;
  superficie_util: number;
  superficie_terraza: number;
  plano_clave: string | null;
  orden: number;
};

type FilaUnidad = {
  id: number;
  tipologia_id: number | null;
  numero: string;
  piso: number | null;
  orientacion: string;
  superficie_util: number;
  superficie_total: number;
  precio_uf: number;
  descuento_pct: number;
  estacionamientos: number;
  bodegas: number;
  estado: EstadoUnidad;
};

const COLUMNAS_TIPOLOGIA = `id, codigo, dormitorios, banos, superficie_util, superficie_terraza, plano_clave, orden`;
const COLUMNAS_UNIDAD = `id, tipologia_id, numero, piso, orientacion, superficie_util, superficie_total,
  precio_uf, descuento_pct, estacionamientos, bodegas, estado`;

const aTipologia = (f: FilaTipologia): Tipologia => ({
  id: f.id,
  codigo: f.codigo,
  dormitorios: f.dormitorios,
  banos: f.banos,
  superficieUtil: f.superficie_util,
  superficieTerraza: f.superficie_terraza,
  ...(f.plano_clave ? { plano: urlPlano(f.plano_clave) } : {}),
  orden: f.orden,
});

const aUnidad = (f: FilaUnidad): Unidad => ({
  id: f.id,
  tipologiaId: f.tipologia_id,
  numero: f.numero,
  ...(f.piso == null ? {} : { piso: f.piso }),
  orientacion: f.orientacion,
  superficieUtil: f.superficie_util,
  superficieTotal: f.superficie_total,
  precioUF: f.precio_uf,
  descuentoPct: f.descuento_pct,
  estacionamientos: f.estacionamientos,
  bodegas: f.bodegas,
  estado: f.estado,
});

/** Lo que se ve en el sitio público: lo vendido y lo bloqueado no se muestra. */
export const ESTADOS_PUBLICOS: EstadoUnidad[] = ['disponible', 'reservada'];

// ─── Guardas ───

/**
 * Las unidades existen solo en un proyecto de inversión en venta. Un retail o
 * un arriendo son una propiedad y nada más, y dejar cargar stock ahí llenaría
 * la ficha de una casa de "unidades" que no existen.
 */
export async function asegurarProyecto(propiedadId: number): Promise<void> {
  const db = await obtenerDB();
  const fila = await db
    .prepare(`SELECT condicion, operacion FROM propiedades WHERE id = ?`)
    .bind(propiedadId)
    .first<{ condicion: string; operacion: string }>();
  if (!fila) throw new ErrorUnidad('No existe esa propiedad', 404);
  if (fila.condicion !== 'nuevo') {
    throw new ErrorUnidad('El stock por unidades es solo de los proyectos de inversión. Cambia el segmento a nuevo.', 409);
  }
  if (fila.operacion !== 'venta') {
    throw new ErrorUnidad('El stock por unidades es solo para proyectos en venta', 409);
  }
}

/**
 * Deja en propiedades.precio_valor el mínimo de las unidades disponibles, que
 * es el "desde" del aviso. Sin unidades disponibles se conserva el último
 * precio: la ficha dice que no queda stock, pero la tarjeta no queda en cero.
 */
export async function recalcularDesde(propiedadId: number): Promise<void> {
  const db = await obtenerDB();
  await db
    .prepare(
      `UPDATE propiedades SET
         precio_valor = COALESCE(
           (SELECT MIN(precio_uf) FROM unidades WHERE propiedad_id = ?1 AND estado = 'disponible'),
           precio_valor),
         precio_moneda = CASE
           WHEN EXISTS(SELECT 1 FROM unidades WHERE propiedad_id = ?1) THEN 'UF'
           ELSE precio_moneda END,
         actualizado_en = datetime('now')
       WHERE id = ?1`,
    )
    .bind(propiedadId)
    .run();
}

// ─── Lecturas ───

export async function tipologiasDeProyecto(propiedadId: number): Promise<Tipologia[]> {
  const db = await obtenerDB();
  const { results } = await db
    .prepare(`SELECT ${COLUMNAS_TIPOLOGIA} FROM tipologias WHERE propiedad_id = ? ORDER BY orden, id`)
    .bind(propiedadId)
    .all<FilaTipologia>();
  return results.map(aTipologia);
}

export async function unidadesDeProyecto(propiedadId: number, soloPublicas = false): Promise<Unidad[]> {
  const db = await obtenerDB();
  const consulta = soloPublicas
    ? db
        .prepare(
          `SELECT ${COLUMNAS_UNIDAD} FROM unidades
           WHERE propiedad_id = ? AND estado IN ('disponible','reservada')
           ORDER BY piso, numero`,
        )
        .bind(propiedadId)
    : db.prepare(`SELECT ${COLUMNAS_UNIDAD} FROM unidades WHERE propiedad_id = ? ORDER BY piso, numero`).bind(propiedadId);
  const { results } = await consulta.all<FilaUnidad>();
  return results.map(aUnidad);
}

const resumenVacio = (): ResumenStock => ({
  total: 0,
  disponibles: 0,
  desdeUF: null,
  dormitoriosMin: 0,
  dormitoriosMax: 0,
  superficieMin: 0,
  superficieMax: 0,
});

/**
 * El resumen del stock de varias propiedades en dos consultas, no una por
 * ficha: lo usa el listado, que arma hasta cientos de tarjetas de una vez.
 * Las propiedades sin unidades no vienen en el mapa.
 */
export async function resumenesStock(ids: number[]): Promise<Map<number, ResumenStock>> {
  const mapa = new Map<number, ResumenStock>();
  if (!ids.length) return mapa;

  const db = await obtenerDB();
  const huecos = ids.map(() => '?').join(',');

  const { results: porUnidades } = await db
    .prepare(
      `SELECT propiedad_id,
              COUNT(*) AS total,
              SUM(CASE WHEN estado = 'disponible' THEN 1 ELSE 0 END) AS disponibles,
              MIN(CASE WHEN estado = 'disponible' THEN precio_uf END) AS desde,
              MIN(CASE WHEN estado = 'disponible' THEN superficie_util END) AS sup_min,
              MAX(CASE WHEN estado = 'disponible' THEN superficie_util END) AS sup_max
         FROM unidades WHERE propiedad_id IN (${huecos}) GROUP BY propiedad_id`,
    )
    .bind(...ids)
    .all<{
      propiedad_id: number;
      total: number;
      disponibles: number;
      desde: number | null;
      sup_min: number | null;
      sup_max: number | null;
    }>();

  for (const fila of porUnidades) {
    mapa.set(fila.propiedad_id, {
      ...resumenVacio(),
      total: fila.total,
      disponibles: fila.disponibles ?? 0,
      desdeUF: fila.desde,
      superficieMin: fila.sup_min ?? 0,
      superficieMax: fila.sup_max ?? 0,
    });
  }

  // Los dormitorios de un proyecto son el rango de sus tipologías: la columna
  // `dormitorios` de la propiedad describe una vivienda sola, no un edificio.
  const { results: porTipologias } = await db
    .prepare(
      `SELECT propiedad_id, MIN(dormitorios) AS minimo, MAX(dormitorios) AS maximo
         FROM tipologias WHERE propiedad_id IN (${huecos}) GROUP BY propiedad_id`,
    )
    .bind(...ids)
    .all<{ propiedad_id: number; minimo: number; maximo: number }>();

  for (const fila of porTipologias) {
    const actual = mapa.get(fila.propiedad_id);
    if (!actual) continue;
    actual.dormitoriosMin = fila.minimo ?? 0;
    actual.dormitoriosMax = fila.maximo ?? 0;
  }

  return mapa;
}

export type Stock = {
  tipologias: TipologiaConStock[];
  unidades: Unidad[];
  resumen: ResumenStock;
};

/** Todo el stock de un proyecto. Con `soloPublicas`, lo que puede ver el sitio. */
export async function stockDeProyecto(propiedadId: number, soloPublicas = false): Promise<Stock> {
  const [tipologias, unidades, resumenes] = await Promise.all([
    tipologiasDeProyecto(propiedadId),
    unidadesDeProyecto(propiedadId, soloPublicas),
    resumenesStock([propiedadId]),
  ]);

  const conStock: TipologiaConStock[] = tipologias.map((t) => {
    const suyas = unidades.filter((u) => u.tipologiaId === t.id);
    const disponibles = suyas.filter((u) => u.estado === 'disponible');
    return {
      ...t,
      total: suyas.length,
      disponibles: disponibles.length,
      desdeUF: disponibles.length ? Math.min(...disponibles.map((u) => u.precioUF)) : null,
    };
  });

  return { tipologias: conStock, unidades, resumen: resumenes.get(propiedadId) ?? resumenVacio() };
}

// ─── Escrituras ───

export type DatosTipologia = {
  codigo: string;
  dormitorios: number;
  banos: number;
  superficieUtil: number;
  superficieTerraza: number;
  orden: number;
};

export type DatosUnidad = {
  tipologiaId: number | null;
  numero: string;
  piso: number | null;
  orientacion: string;
  superficieUtil: number;
  superficieTotal: number;
  precioUF: number;
  descuentoPct: number;
  estacionamientos: number;
  bodegas: number;
  estado: EstadoUnidad;
};

const esChoque = (e: unknown) => e instanceof Error && /UNIQUE/i.test(e.message);

export async function crearTipologia(propiedadId: number, d: DatosTipologia): Promise<number> {
  await asegurarProyecto(propiedadId);
  const db = await obtenerDB();
  try {
    const fila = await db
      .prepare(
        `INSERT INTO tipologias (propiedad_id, codigo, dormitorios, banos, superficie_util, superficie_terraza, orden)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .bind(propiedadId, d.codigo, d.dormitorios, d.banos, d.superficieUtil, d.superficieTerraza, d.orden)
      .first<{ id: number }>();
    return fila!.id;
  } catch (e) {
    if (esChoque(e)) throw new ErrorUnidad(`El proyecto ya tiene una tipología ${d.codigo}`, 409);
    throw e;
  }
}

export async function actualizarTipologia(propiedadId: number, id: number, d: DatosTipologia): Promise<void> {
  const db = await obtenerDB();
  try {
    const resultado = await db
      .prepare(
        `UPDATE tipologias SET codigo = ?, dormitorios = ?, banos = ?, superficie_util = ?, superficie_terraza = ?, orden = ?
           WHERE id = ? AND propiedad_id = ?`,
      )
      .bind(d.codigo, d.dormitorios, d.banos, d.superficieUtil, d.superficieTerraza, d.orden, id, propiedadId)
      .run();
    if (!resultado.meta.changes) throw new ErrorUnidad('Esa tipología no es de este proyecto', 404);
  } catch (e) {
    if (esChoque(e)) throw new ErrorUnidad(`El proyecto ya tiene una tipología ${d.codigo}`, 409);
    throw e;
  }
}

/** Las unidades que la usaban quedan sin tipología (ON DELETE SET NULL), no se borran. */
export async function eliminarTipologia(propiedadId: number, id: number): Promise<void> {
  const db = await obtenerDB();
  const resultado = await db.prepare(`DELETE FROM tipologias WHERE id = ? AND propiedad_id = ?`).bind(id, propiedadId).run();
  if (!resultado.meta.changes) throw new ErrorUnidad('Esa tipología no es de este proyecto', 404);
}

/** La tipología tiene que ser del mismo proyecto: si no, una unidad apuntaría a la planta de otro edificio. */
async function asegurarTipologiaDelProyecto(propiedadId: number, tipologiaId: number | null): Promise<void> {
  if (tipologiaId == null) return;
  const db = await obtenerDB();
  const fila = await db
    .prepare(`SELECT id FROM tipologias WHERE id = ? AND propiedad_id = ?`)
    .bind(tipologiaId, propiedadId)
    .first<{ id: number }>();
  if (!fila) throw new ErrorUnidad('Esa tipología no es de este proyecto', 422);
}

export async function crearUnidad(propiedadId: number, d: DatosUnidad): Promise<number> {
  await asegurarProyecto(propiedadId);
  await asegurarTipologiaDelProyecto(propiedadId, d.tipologiaId);
  const db = await obtenerDB();
  try {
    const fila = await db
      .prepare(
        `INSERT INTO unidades (propiedad_id, tipologia_id, numero, piso, orientacion, superficie_util, superficie_total,
                               precio_uf, descuento_pct, estacionamientos, bodegas, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .bind(
        propiedadId,
        d.tipologiaId,
        d.numero,
        d.piso,
        d.orientacion,
        d.superficieUtil,
        d.superficieTotal,
        d.precioUF,
        d.descuentoPct,
        d.estacionamientos,
        d.bodegas,
        d.estado,
      )
      .first<{ id: number }>();
    await recalcularDesde(propiedadId);
    return fila!.id;
  } catch (e) {
    if (esChoque(e)) throw new ErrorUnidad(`El proyecto ya tiene la unidad ${d.numero}`, 409);
    throw e;
  }
}

export async function actualizarUnidad(propiedadId: number, id: number, d: DatosUnidad): Promise<void> {
  await asegurarTipologiaDelProyecto(propiedadId, d.tipologiaId);
  const db = await obtenerDB();
  try {
    const resultado = await db
      .prepare(
        `UPDATE unidades SET tipologia_id = ?, numero = ?, piso = ?, orientacion = ?, superficie_util = ?,
                             superficie_total = ?, precio_uf = ?, descuento_pct = ?, estacionamientos = ?,
                             bodegas = ?, estado = ?, actualizado_en = datetime('now')
           WHERE id = ? AND propiedad_id = ?`,
      )
      .bind(
        d.tipologiaId,
        d.numero,
        d.piso,
        d.orientacion,
        d.superficieUtil,
        d.superficieTotal,
        d.precioUF,
        d.descuentoPct,
        d.estacionamientos,
        d.bodegas,
        d.estado,
        id,
        propiedadId,
      )
      .run();
    if (!resultado.meta.changes) throw new ErrorUnidad('Esa unidad no es de este proyecto', 404);
    await recalcularDesde(propiedadId);
  } catch (e) {
    if (esChoque(e)) throw new ErrorUnidad(`El proyecto ya tiene la unidad ${d.numero}`, 409);
    throw e;
  }
}

export async function eliminarUnidad(propiedadId: number, id: number): Promise<void> {
  const db = await obtenerDB();
  const resultado = await db.prepare(`DELETE FROM unidades WHERE id = ? AND propiedad_id = ?`).bind(id, propiedadId).run();
  if (!resultado.meta.changes) throw new ErrorUnidad('Esa unidad no es de este proyecto', 404);
  await recalcularDesde(propiedadId);
}

/**
 * Cambia el estado de varias unidades de una vez, que es como llega el aviso
 * de la inmobiliaria ("se vendieron la 302, la 304 y la 1201"). Se rechaza
 * entero si alguno de los ids no es de este proyecto.
 */
export async function cambiarEstadoUnidades(propiedadId: number, ids: number[], estado: EstadoUnidad): Promise<number> {
  if (!ids.length) throw new ErrorUnidad('Elige al menos una unidad', 422);
  const db = await obtenerDB();
  const huecos = ids.map(() => '?').join(',');
  const fila = await db
    .prepare(`SELECT COUNT(*) AS cuantas FROM unidades WHERE propiedad_id = ? AND id IN (${huecos})`)
    .bind(propiedadId, ...ids)
    .first<{ cuantas: number }>();
  if ((fila?.cuantas ?? 0) !== new Set(ids).size) {
    throw new ErrorUnidad('Alguna de esas unidades no es de este proyecto. Recarga la página.', 409);
  }

  const resultado = await db
    .prepare(`UPDATE unidades SET estado = ?, actualizado_en = datetime('now') WHERE propiedad_id = ? AND id IN (${huecos})`)
    .bind(estado, propiedadId, ...ids)
    .run();
  await recalcularDesde(propiedadId);
  return resultado.meta.changes ?? 0;
}

// ─── Importación desde la planilla de la inmobiliaria ───

export type CambioImportacion = { fila: FilaImportada; antes: Unidad };

export type PlanImportacion = {
  nuevas: FilaImportada[];
  cambian: CambioImportacion[];
  /** Cuántas venían idénticas a lo que ya estaba guardado. */
  iguales: number;
  /** Unidades guardadas que la planilla no menciona. Solo se borran con `reemplazar`. */
  sobran: Unidad[];
  /** Códigos de tipología que habría que crear. */
  tipologiasNuevas: string[];
};

const clave = (codigo: string) =>
  codigo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const mismoNumero = (a: number, b: number) => Math.abs(a - b) < 0.005;

/**
 * Compara la planilla con lo guardado sin escribir nada: es lo que el panel
 * muestra antes de confirmar. La planilla de una inmobiliaria llega sucia
 * siempre, y aplicarla a ciegas pisa precios y estados sin que nadie lo vea.
 */
export async function planearImportacion(propiedadId: number, filas: FilaImportada[]): Promise<PlanImportacion> {
  await asegurarProyecto(propiedadId);
  const [tipologias, unidades] = await Promise.all([tipologiasDeProyecto(propiedadId), unidadesDeProyecto(propiedadId)]);

  const porCodigo = new Map(tipologias.map((t) => [clave(t.codigo), t]));
  const porNumero = new Map(unidades.map((u) => [u.numero, u]));
  const enLaPlanilla = new Set(filas.map((f) => f.numero));

  const nuevas: FilaImportada[] = [];
  const cambian: CambioImportacion[] = [];
  let iguales = 0;
  const tipologiasNuevas = new Set<string>();

  for (const fila of filas) {
    if (fila.tipologia && !porCodigo.has(clave(fila.tipologia))) tipologiasNuevas.add(fila.tipologia);

    const antes = porNumero.get(fila.numero);
    if (!antes) {
      nuevas.push(fila);
      continue;
    }

    const tipologiaAntes = antes.tipologiaId;
    const tipologiaAhora = fila.tipologia ? (porCodigo.get(clave(fila.tipologia))?.id ?? null) : tipologiaAntes;

    const igual =
      antes.precioUF === fila.precioUF &&
      antes.estado === fila.estado &&
      (antes.piso ?? null) === fila.piso &&
      antes.orientacion === fila.orientacion &&
      mismoNumero(antes.superficieUtil, fila.superficieUtil) &&
      mismoNumero(antes.superficieTotal, fila.superficieTotal) &&
      mismoNumero(antes.descuentoPct, fila.descuentoPct) &&
      antes.estacionamientos === fila.estacionamientos &&
      antes.bodegas === fila.bodegas &&
      // Una tipología todavía sin crear no cuenta como cambio hasta que exista.
      (tipologiaAhora === tipologiaAntes || (fila.tipologia !== '' && tipologiaAhora === null));

    if (igual) iguales += 1;
    else cambian.push({ fila, antes });
  }

  return {
    nuevas,
    cambian,
    iguales,
    sobran: unidades.filter((u) => !enLaPlanilla.has(u.numero)),
    tipologiasNuevas: [...tipologiasNuevas],
  };
}

export type ResultadoImportacion = {
  creadas: number;
  actualizadas: number;
  borradas: number;
  tipologiasCreadas: number;
};

// D1 acepta lotes grandes, pero una planilla de 2.000 filas en un solo batch
// es un pedido enorme para los 10 ms de CPU del plan gratis. Se parte.
const TAMANO_LOTE = 100;

/**
 * Aplica la planilla. Las unidades se reconocen por su número, así que volver
 * a cargar la misma planilla actualiza en vez de duplicar. Con `reemplazar`,
 * las que ya no aparecen se borran; sin él se dejan como están, que es lo
 * normal cuando la inmobiliaria manda solo las torres que cambiaron.
 */
export async function aplicarImportacion(
  propiedadId: number,
  filas: FilaImportada[],
  reemplazar = false,
): Promise<ResultadoImportacion> {
  await asegurarProyecto(propiedadId);
  const db = await obtenerDB();

  // Las tipologías que la planilla nombra y no existen se crean primero, con
  // los dormitorios y baños leídos del propio código (2D/2B) y los m² de la
  // primera unidad que la usa: después se corrigen a mano si hace falta.
  const existentes = await tipologiasDeProyecto(propiedadId);
  const porCodigo = new Map(existentes.map((t) => [clave(t.codigo), t.id]));
  let tipologiasCreadas = 0;

  for (const fila of filas) {
    if (!fila.tipologia || porCodigo.has(clave(fila.tipologia))) continue;
    const { dormitorios, banos } = medidasDeCodigo(fila.tipologia);
    const id = await crearTipologia(propiedadId, {
      codigo: fila.tipologia,
      dormitorios,
      banos,
      superficieUtil: fila.superficieUtil,
      superficieTerraza: 0,
      orden: existentes.length + tipologiasCreadas,
    });
    porCodigo.set(clave(fila.tipologia), id);
    tipologiasCreadas += 1;
  }

  const guardadas = await unidadesDeProyecto(propiedadId);
  const porNumero = new Map(guardadas.map((u) => [u.numero, u]));
  const enLaPlanilla = new Set(filas.map((f) => f.numero));

  const sentencias: D1PreparedStatement[] = [];
  let creadas = 0;
  let actualizadas = 0;

  for (const fila of filas) {
    const antes = porNumero.get(fila.numero);
    const tipologiaId = fila.tipologia ? (porCodigo.get(clave(fila.tipologia)) ?? null) : (antes?.tipologiaId ?? null);

    if (antes) {
      actualizadas += 1;
      sentencias.push(
        db
          .prepare(
            `UPDATE unidades SET tipologia_id = ?, piso = ?, orientacion = ?, superficie_util = ?, superficie_total = ?,
                                 precio_uf = ?, descuento_pct = ?, estacionamientos = ?, bodegas = ?, estado = ?,
                                 actualizado_en = datetime('now')
               WHERE id = ? AND propiedad_id = ?`,
          )
          .bind(
            tipologiaId,
            fila.piso,
            fila.orientacion,
            fila.superficieUtil,
            fila.superficieTotal,
            fila.precioUF,
            fila.descuentoPct,
            fila.estacionamientos,
            fila.bodegas,
            fila.estado,
            antes.id,
            propiedadId,
          ),
      );
    } else {
      creadas += 1;
      sentencias.push(
        db
          .prepare(
            `INSERT INTO unidades (propiedad_id, tipologia_id, numero, piso, orientacion, superficie_util,
                                   superficie_total, precio_uf, descuento_pct, estacionamientos, bodegas, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            propiedadId,
            tipologiaId,
            fila.numero,
            fila.piso,
            fila.orientacion,
            fila.superficieUtil,
            fila.superficieTotal,
            fila.precioUF,
            fila.descuentoPct,
            fila.estacionamientos,
            fila.bodegas,
            fila.estado,
          ),
      );
    }
  }

  let borradas = 0;
  if (reemplazar) {
    const sobran = guardadas.filter((u) => !enLaPlanilla.has(u.numero));
    borradas = sobran.length;
    for (const unidad of sobran) {
      sentencias.push(db.prepare(`DELETE FROM unidades WHERE id = ? AND propiedad_id = ?`).bind(unidad.id, propiedadId));
    }
  }

  for (let i = 0; i < sentencias.length; i += TAMANO_LOTE) {
    await db.batch(sentencias.slice(i, i + TAMANO_LOTE));
  }
  await recalcularDesde(propiedadId);

  return { creadas, actualizadas, borradas, tipologiasCreadas };
}

/**
 * El stock que puede ver el sitio, buscado por el slug de la ficha. Va acá y
 * no en propiedades.ts para no tener que exponer el id en el tipo público:
 * la ficha nunca necesitó saberlo.
 */
export async function stockPublicoPorSlug(slug: string): Promise<Stock | null> {
  const db = await obtenerDB();
  const fila = await db
    .prepare(`SELECT id FROM propiedades WHERE slug = ? AND estado = 'PUBLICADA' AND condicion = 'nuevo'`)
    .bind(slug)
    .first<{ id: number }>();
  if (!fila) return null;
  return stockDeProyecto(fila.id, true);
}
