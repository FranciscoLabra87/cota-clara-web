import { nombreTipo, type TipoPropiedad } from '@/data/properties';
import type { Sesion } from './auth';
import { obtenerDB } from './db';
import type { EstadoTarea } from './tareas-estados';
import { diaDeChile } from './visitas';

export { ESTADOS_TAREA, esEstadoTarea, nombreEstadoTarea, type EstadoTarea } from './tareas-estados';

// Tareas del equipo. Cada una puede tener responsable, fecha límite y quedar
// ligada a una propiedad o a un interesado del CRM.

export class ErrorTarea extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type Tarea = {
  id: number;
  titulo: string;
  detalle: string;
  estado: EstadoTarea;
  responsableId: number | null;
  responsableNombre: string | null;
  /** AAAA-MM-DD */
  venceEn: string | null;
  propiedadId: number | null;
  propiedadTitulo: string | null;
  interesadoId: number | null;
  interesadoNombre: string | null;
  creadoPor: number | null;
};

export type DatosTarea = {
  titulo: string;
  detalle: string;
  responsableId: number | null;
  venceEn: string | null;
  propiedadId: number | null;
  interesadoId: number | null;
};

export const MAX_DETALLE_TAREA = 2000;

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const esFecha = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** Id opcional: vacío es null; algo que no es un id es undefined (error). */
function idOpcional(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function validarTarea(body: Record<string, unknown>): { ok: true; datos: DatosTarea } | { ok: false; error: string } {
  const titulo = texto(body.titulo, 160);
  if (titulo.length < 2) return { ok: false, error: 'Escribe qué hay que hacer' };

  const detalle = typeof body.detalle === 'string' ? body.detalle.trim() : '';
  if (detalle.length > MAX_DETALLE_TAREA) return { ok: false, error: `El detalle pasa de ${MAX_DETALLE_TAREA} caracteres` };

  const venceEn = texto(body.venceEn, 10) || null;
  if (venceEn && !esFecha(venceEn)) return { ok: false, error: 'La fecha límite no es válida' };

  const responsableId = idOpcional(body.responsableId);
  const propiedadId = idOpcional(body.propiedadId);
  const interesadoId = idOpcional(body.interesadoId);
  if (responsableId === undefined || propiedadId === undefined || interesadoId === undefined) {
    return { ok: false, error: 'Revisa el responsable, la propiedad o el interesado' };
  }

  return { ok: true, datos: { titulo, detalle, responsableId, venceEn, propiedadId, interesadoId } };
}

// ─── Lecturas ───

type Fila = {
  id: number;
  titulo: string;
  detalle: string;
  estado: EstadoTarea;
  responsable_id: number | null;
  responsable_nombre: string | null;
  vence_en: string | null;
  propiedad_id: number | null;
  propiedad_titulo: string | null;
  propiedad_tipo: TipoPropiedad | null;
  propiedad_comuna: string | null;
  interesado_id: number | null;
  interesado_nombre: string | null;
  creado_por: number | null;
};

const aTarea = (f: Fila): Tarea => ({
  id: f.id,
  titulo: f.titulo,
  detalle: f.detalle,
  estado: f.estado,
  responsableId: f.responsable_id,
  responsableNombre: f.responsable_nombre,
  venceEn: f.vence_en,
  propiedadId: f.propiedad_id,
  propiedadTitulo:
    f.propiedad_id === null
      ? null
      : f.propiedad_titulo?.trim() || `${nombreTipo(f.propiedad_tipo ?? 'casa')} · ${f.propiedad_comuna ?? ''}`,
  interesadoId: f.interesado_id,
  interesadoNombre: f.interesado_nombre,
  creadoPor: f.creado_por,
});

/**
 * Las tareas abiertas y las hechas en los últimos 30 días: las hechas más
 * viejas salen del tablero para que no lo tapen. Primero las que vencen antes.
 */
export async function listarTareas(filtro: { propiedadId?: number } = {}): Promise<Tarea[]> {
  const db = await obtenerDB();
  const { results } = await db
    .prepare(
      `SELECT t.id, t.titulo, t.detalle, t.estado, t.responsable_id, u.nombre AS responsable_nombre, t.vence_en,
              t.propiedad_id, p.titulo AS propiedad_titulo, p.tipo AS propiedad_tipo, p.comuna AS propiedad_comuna,
              t.interesado_id, i.nombre AS interesado_nombre, t.creado_por
       FROM tareas t
       LEFT JOIN usuarios u ON u.id = t.responsable_id
       LEFT JOIN propiedades p ON p.id = t.propiedad_id
       LEFT JOIN crm_interesados i ON i.id = t.interesado_id
       WHERE (t.estado <> 'hecha' OR t.completada_en >= datetime('now', '-30 days'))
         ${filtro.propiedadId ? 'AND t.propiedad_id = ?' : ''}
       ORDER BY t.vence_en IS NULL, t.vence_en, t.id DESC`,
    )
    .bind(...(filtro.propiedadId ? [filtro.propiedadId] : []))
    .all<Fila>();
  return results.map(aTarea);
}

/** Para el inicio del panel: las abiertas de una persona y cuántas ya vencieron. */
export async function pendientesDe(usuarioId: number, hoy = diaDeChile()): Promise<{ abiertas: number; vencidas: number }> {
  const db = await obtenerDB();
  const fila = await db
    .prepare(
      `SELECT COUNT(*) AS abiertas, COUNT(CASE WHEN vence_en < ? THEN 1 END) AS vencidas
       FROM tareas WHERE responsable_id = ? AND estado <> 'hecha'`,
    )
    .bind(hoy, usuarioId)
    .first<{ abiertas: number; vencidas: number }>();
  return { abiertas: fila?.abiertas ?? 0, vencidas: fila?.vencidas ?? 0 };
}

/** Las personas a quienes se les puede asignar una tarea. */
export async function responsables(): Promise<{ id: number; nombre: string }[]> {
  const db = await obtenerDB();
  const { results } = await db
    .prepare(`SELECT id, nombre FROM usuarios WHERE activo = 1 ORDER BY nombre`)
    .all<{ id: number; nombre: string }>();
  return results;
}

// ─── Escrituras ───

/**
 * Revisa que lo enlazado exista. Si viene un interesado, la propiedad se toma
 * de él: así una tarea nunca queda ligada a un cliente de otra propiedad.
 */
async function enlaces(d: DatosTarea): Promise<DatosTarea> {
  const db = await obtenerDB();
  if (d.responsableId !== null) {
    const u = await db.prepare(`SELECT id FROM usuarios WHERE id = ? AND activo = 1`).bind(d.responsableId).first();
    if (!u) throw new ErrorTarea('El responsable no existe o está desactivado', 422);
  }
  if (d.interesadoId !== null) {
    const i = await db
      .prepare(`SELECT propiedad_id FROM crm_interesados WHERE id = ?`)
      .bind(d.interesadoId)
      .first<{ propiedad_id: number }>();
    if (!i) throw new ErrorTarea('El interesado ya no existe', 422);
    return { ...d, propiedadId: i.propiedad_id };
  }
  if (d.propiedadId !== null) {
    const p = await db.prepare(`SELECT id FROM propiedades WHERE id = ?`).bind(d.propiedadId).first();
    if (!p) throw new ErrorTarea('La propiedad no existe', 422);
  }
  return d;
}

export async function crearTarea(datos: DatosTarea, usuarioId: number): Promise<number> {
  const d = await enlaces(datos);
  const db = await obtenerDB();
  const fila = await db
    .prepare(
      `INSERT INTO tareas (titulo, detalle, responsable_id, vence_en, propiedad_id, interesado_id, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(d.titulo, d.detalle, d.responsableId, d.venceEn, d.propiedadId, d.interesadoId, usuarioId)
    .first<{ id: number }>();
  return fila!.id;
}

async function tareaPorId(id: number) {
  const db = await obtenerDB();
  const fila = await db
    .prepare(`SELECT id, creado_por FROM tareas WHERE id = ?`)
    .bind(id)
    .first<{ id: number; creado_por: number | null }>();
  if (!fila) throw new ErrorTarea('La tarea ya no existe', 404);
  return fila;
}

export async function actualizarTarea(id: number, datos: DatosTarea): Promise<void> {
  await tareaPorId(id);
  const d = await enlaces(datos);
  const db = await obtenerDB();
  await db
    .prepare(
      `UPDATE tareas SET titulo = ?, detalle = ?, responsable_id = ?, vence_en = ?, propiedad_id = ?, interesado_id = ?,
              actualizado_en = datetime('now')
       WHERE id = ?`,
    )
    .bind(d.titulo, d.detalle, d.responsableId, d.venceEn, d.propiedadId, d.interesadoId, id)
    .run();
}

/** Al pasar a Hecha se anota cuándo; si vuelve atrás, se limpia. */
export async function moverTarea(id: number, estado: EstadoTarea): Promise<void> {
  await tareaPorId(id);
  const db = await obtenerDB();
  await db
    .prepare(
      `UPDATE tareas SET estado = ?1,
              completada_en = CASE WHEN ?1 = 'hecha' THEN COALESCE(completada_en, datetime('now')) ELSE NULL END,
              actualizado_en = datetime('now')
       WHERE id = ?2`,
    )
    .bind(estado, id)
    .run();
}

/** La borra quien la creó o un administrador. */
export async function borrarTarea(id: number, sesion: Pick<Sesion, 'usuario_id' | 'rol'>): Promise<void> {
  const tarea = await tareaPorId(id);
  if (sesion.rol !== 'ADMIN' && tarea.creado_por !== sesion.usuario_id) {
    throw new ErrorTarea('Solo quien la creó o un administrador puede borrarla', 403);
  }
  const db = await obtenerDB();
  await db.prepare(`DELETE FROM tareas WHERE id = ?`).bind(id).run();
}
