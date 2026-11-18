import type { Sesion } from './auth';
import type { Etapa, TipoActividad, TipoManual } from './crm-etapas';
import { obtenerDB } from './db';
import { MOTIVO_REUNION } from '@/data/properties';
import type { Lead } from './leads';

// CRM del panel: los interesados de cada propiedad, la etapa en que va cada
// uno (las columnas del kanban) y su historial de llamadas, visitas físicas,
// mensajes y notas. Es interno: el sitio público nunca lee estas tablas.

export {
  ETAPAS,
  TIPOS_ACTIVIDAD,
  esEtapa,
  esTipoManual,
  nombreActividad,
  nombreEtapa,
  type Etapa,
  type TipoActividad,
  type TipoManual,
} from './crm-etapas';

/** Las que cuentan como contacto con el cliente para «último contacto». */
const CONTACTOS = `('llamada','visita','mensaje')`;
const CERRADAS = `('cerrado','descartado')`;

export class ErrorCrm extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type Interesado = {
  id: number;
  propiedadId: number;
  nombre: string;
  telefono: string;
  email: string;
  etapa: Etapa;
  origen: 'manual' | 'formulario';
  creadoPor: number | null;
  /** UTC, como lo entrega SQLite. */
  creadoEn: string;
};

export type Actividad = {
  id: number;
  interesadoId: number;
  tipo: TipoActividad;
  detalle: string;
  usuarioNombre: string | null;
  /** UTC, como lo entrega SQLite. */
  fecha: string;
};

export type UltimoContacto = {
  tipo: TipoActividad;
  usuarioNombre: string | null;
  interesadoNombre: string;
  fecha: string;
};

export type Resumen = {
  interesados: number;
  activos: number;
  llamadas: number;
  visitas: number;
  ultimo: UltimoContacto | null;
};

// ─── Validación ───

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DatosInteresado = { nombre: string; telefono: string; email: string };

export function validarInteresado(body: Record<string, unknown>): { ok: true; datos: DatosInteresado } | { ok: false; error: string } {
  const nombre = texto(body.nombre, 120);
  if (nombre.length < 2) return { ok: false, error: 'Escribe el nombre del interesado' };
  const email = texto(body.email, 160);
  if (email && !EMAIL.test(email)) return { ok: false, error: 'El correo no es válido' };
  return { ok: true, datos: { nombre, telefono: texto(body.telefono, 40), email } };
}

export const MAX_DETALLE = 2000;

// ─── Lecturas ───

type FilaInteresado = {
  id: number;
  propiedad_id: number;
  nombre: string;
  telefono: string;
  email: string;
  etapa: Etapa;
  origen: 'manual' | 'formulario';
  creado_por: number | null;
  creado_en: string;
};

const aInteresado = (f: FilaInteresado): Interesado => ({
  id: f.id,
  propiedadId: f.propiedad_id,
  nombre: f.nombre,
  telefono: f.telefono,
  email: f.email,
  etapa: f.etapa,
  origen: f.origen,
  creadoPor: f.creado_por,
  creadoEn: f.creado_en,
});

export async function interesadosDe(propiedadId: number): Promise<Interesado[]> {
  const db = await obtenerDB();
  const { results } = await db
    .prepare(
      `SELECT id, propiedad_id, nombre, telefono, email, etapa, origen, creado_por, creado_en
       FROM crm_interesados WHERE propiedad_id = ? ORDER BY actualizado_en DESC, id DESC`,
    )
    .bind(propiedadId)
    .all<FilaInteresado>();
  return results.map(aInteresado);
}

/** Todo el historial de los interesados de una propiedad, lo más nuevo primero. */
export async function actividadesDe(propiedadId: number): Promise<Actividad[]> {
  const db = await obtenerDB();
  const { results } = await db
    .prepare(
      `SELECT a.id, a.interesado_id, a.tipo, a.detalle, u.nombre AS usuario_nombre, a.fecha
       FROM crm_actividades a
       JOIN crm_interesados i ON i.id = a.interesado_id
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       WHERE i.propiedad_id = ?
       ORDER BY a.fecha DESC, a.id DESC`,
    )
    .bind(propiedadId)
    .all<{ id: number; interesado_id: number; tipo: TipoActividad; detalle: string; usuario_nombre: string | null; fecha: string }>();
  return results.map((f) => ({
    id: f.id,
    interesadoId: f.interesado_id,
    tipo: f.tipo,
    detalle: f.detalle,
    usuarioNombre: f.usuario_nombre,
    fecha: f.fecha,
  }));
}

/**
 * Los números de cada propiedad para la vista general y la cabecera del
 * tablero. Las propiedades sin interesados no vienen en el mapa.
 */
export async function resumenes(propiedadId?: number): Promise<Map<number, Resumen>> {
  const db = await obtenerDB();
  const filtro = propiedadId ? 'WHERE i.propiedad_id = ?' : '';
  const enlaces = propiedadId ? [propiedadId] : [];

  const [conteos, ultimos] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT i.propiedad_id,
                COUNT(DISTINCT i.id) AS interesados,
                COUNT(DISTINCT CASE WHEN i.etapa NOT IN ${CERRADAS} THEN i.id END) AS activos,
                COUNT(CASE WHEN a.tipo = 'llamada' THEN 1 END) AS llamadas,
                COUNT(CASE WHEN a.tipo = 'visita' THEN 1 END) AS visitas
         FROM crm_interesados i
         LEFT JOIN crm_actividades a ON a.interesado_id = i.id
         ${filtro}
         GROUP BY i.propiedad_id`,
      )
      .bind(...enlaces),
    // El último contacto de cada propiedad: la actividad de contacto más nueva.
    db
      .prepare(
        `SELECT propiedad_id, tipo, usuario_nombre, interesado_nombre, fecha FROM (
           SELECT i.propiedad_id, a.tipo, u.nombre AS usuario_nombre, i.nombre AS interesado_nombre, a.fecha,
                  ROW_NUMBER() OVER (PARTITION BY i.propiedad_id ORDER BY a.fecha DESC, a.id DESC) AS n
           FROM crm_actividades a
           JOIN crm_interesados i ON i.id = a.interesado_id
           LEFT JOIN usuarios u ON u.id = a.usuario_id
           WHERE a.tipo IN ${CONTACTOS} ${propiedadId ? 'AND i.propiedad_id = ?' : ''}
         ) WHERE n = 1`,
      )
      .bind(...enlaces),
  ]);

  const mapa = new Map<number, Resumen>();
  for (const f of conteos.results) {
    mapa.set(Number(f.propiedad_id), {
      interesados: Number(f.interesados),
      activos: Number(f.activos),
      llamadas: Number(f.llamadas),
      visitas: Number(f.visitas),
      ultimo: null,
    });
  }
  for (const f of ultimos.results) {
    const resumen = mapa.get(Number(f.propiedad_id));
    if (!resumen) continue;
    resumen.ultimo = {
      tipo: f.tipo as TipoActividad,
      usuarioNombre: (f.usuario_nombre as string | null) ?? null,
      interesadoNombre: String(f.interesado_nombre),
      fecha: String(f.fecha),
    };
  }
  return mapa;
}

// ─── Escrituras ───

async function existePropiedad(propiedadId: number) {
  const db = await obtenerDB();
  return !!(await db.prepare(`SELECT id FROM propiedades WHERE id = ?`).bind(propiedadId).first());
}

export async function crearInteresado(
  propiedadId: number,
  datos: DatosInteresado,
  usuarioId: number,
): Promise<number> {
  if (!(await existePropiedad(propiedadId))) throw new ErrorCrm('La propiedad no existe', 404);
  const db = await obtenerDB();
  const fila = await db
    .prepare(
      `INSERT INTO crm_interesados (propiedad_id, nombre, telefono, email, creado_por)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(propiedadId, datos.nombre, datos.telefono, datos.email, usuarioId)
    .first<{ id: number }>();
  return fila!.id;
}

async function interesadoPorId(id: number) {
  const db = await obtenerDB();
  const fila = await db
    .prepare(
      `SELECT id, propiedad_id, nombre, telefono, email, etapa, origen, creado_por, creado_en FROM crm_interesados WHERE id = ?`,
    )
    .bind(id)
    .first<FilaInteresado>();
  if (!fila) throw new ErrorCrm('El interesado ya no existe', 404);
  return aInteresado(fila);
}

export async function actualizarInteresado(id: number, datos: DatosInteresado): Promise<void> {
  await interesadoPorId(id);
  const db = await obtenerDB();
  await db
    .prepare(
      `UPDATE crm_interesados SET nombre = ?, telefono = ?, email = ?, actualizado_en = datetime('now') WHERE id = ?`,
    )
    .bind(datos.nombre, datos.telefono, datos.email, id)
    .run();
}

/** Mueve la tarjeta y deja el cambio en el historial, en una sola transacción. */
export async function moverEtapa(id: number, etapa: Etapa, usuarioId: number): Promise<void> {
  const actual = await interesadoPorId(id);
  if (actual.etapa === etapa) return;
  const db = await obtenerDB();
  await db.batch([
    db.prepare(`UPDATE crm_interesados SET etapa = ?, actualizado_en = datetime('now') WHERE id = ?`).bind(etapa, id),
    db
      .prepare(`INSERT INTO crm_actividades (interesado_id, tipo, detalle, usuario_id) VALUES (?, 'etapa', ?, ?)`)
      .bind(id, etapa, usuarioId),
  ]);
}

export async function registrarActividad(
  id: number,
  tipo: TipoManual,
  detalle: string,
  usuarioId: number,
): Promise<number> {
  await interesadoPorId(id);
  if (tipo === 'nota' && !detalle) throw new ErrorCrm('Escribe la nota', 422);
  if (detalle.length > MAX_DETALLE) throw new ErrorCrm(`La observación pasa de ${MAX_DETALLE} caracteres`, 422);
  const db = await obtenerDB();
  const [insercion] = await db.batch<{ id: number }>([
    db
      .prepare(`INSERT INTO crm_actividades (interesado_id, tipo, detalle, usuario_id) VALUES (?, ?, ?, ?) RETURNING id`)
      .bind(id, tipo, detalle, usuarioId),
    db.prepare(`UPDATE crm_interesados SET actualizado_en = datetime('now') WHERE id = ?`).bind(id),
  ]);
  return insercion.results[0].id;
}

/** Lo borra quien lo creó o un administrador. Su historial cae con él. */
export async function borrarInteresado(id: number, sesion: Pick<Sesion, 'usuario_id' | 'rol'>): Promise<void> {
  const actual = await interesadoPorId(id);
  if (sesion.rol !== 'ADMIN' && actual.creadoPor !== sesion.usuario_id) {
    throw new ErrorCrm('Solo quien lo agregó o un administrador puede borrarlo', 403);
  }
  const db = await obtenerDB();
  await db.prepare(`DELETE FROM crm_interesados WHERE id = ?`).bind(id).run();
}

/**
 * Una solicitud de visita desde la ficha de una propiedad entra sola como
 * tarjeta «Nuevo» en su tablero, con el mensaje como primera nota. Las demás
 * variantes del formulario no traen propiedad y se quedan en Solicitudes.
 * El UNIQUE de solicitud_id evita duplicarla si se llama dos veces.
 */
export async function interesadoDesdeSolicitud(solicitudId: number, lead: Lead): Promise<number | null> {
  if (lead.variante !== 'visita' || !lead.propiedad) return null;
  const db = await obtenerDB();
  const propiedad = await db.prepare(`SELECT id FROM propiedades WHERE slug = ?`).bind(lead.propiedad).first<{ id: number }>();
  if (!propiedad) return null;

  const fila = await db
    .prepare(
      `INSERT INTO crm_interesados (propiedad_id, nombre, telefono, email, origen, solicitud_id)
       VALUES (?, ?, ?, ?, 'formulario', ?)
       ON CONFLICT(solicitud_id) DO NOTHING
       RETURNING id`,
    )
    .bind(propiedad.id, lead.nombre, lead.telefono, lead.email, solicitudId)
    .first<{ id: number }>();
  if (!fila) return null;

  const partes = [lead.motivo === MOTIVO_REUNION ? 'Pidió una reunión desde el sitio.' : 'Pidió información desde el sitio.'];
  if (lead.fecha) partes.push(`Fecha preferida: ${lead.fecha}.`);
  if (lead.mensaje) partes.push(lead.mensaje);
  await db
    .prepare(`INSERT INTO crm_actividades (interesado_id, tipo, detalle) VALUES (?, 'nota', ?)`)
    .bind(fila.id, partes.join(' ').slice(0, MAX_DETALLE))
    .run();
  return fila.id;
}
