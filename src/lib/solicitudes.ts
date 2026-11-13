import { obtenerDB } from './db';
import type { EnvioLead, Lead } from './leads';

// Registro de las solicitudes que llegan por los formularios del sitio.
// El correo es solo el aviso: lo que no se puede perder queda acá.

export type Variante = 'contacto' | 'tasacion' | 'visita';
export type EstadoCorreo = 'pendiente' | EnvioLead['estado'];

export type Solicitud = Omit<Lead, 'variante'> & {
  id: number;
  variante: Variante;
  correo: EstadoCorreo;
  /** Fecha y hora UTC en que llegó, como la entrega SQLite. */
  creadaEn: string;
};

const VARIANTES: Variante[] = ['contacto', 'tasacion', 'visita'];

/** La variante viene del request: lo que no se conoce se guarda como consulta. */
export const varianteDe = (valor: string): Variante => (VARIANTES.includes(valor as Variante) ? (valor as Variante) : 'contacto');

// Tope de solicitudes en diez minutos. El formulario es público y escribe en
// la base: sin esto, un script puede llenarla de basura y tapar las reales.
// Por conexión es bajo, porque nadie manda seis formularios seguidos; el tope
// general es la válvula por si llegan desde muchas direcciones a la vez.
export const MAX_POR_IP = 5;
export const MAX_GENERAL = 100;

export async function superaElTope(ip: string | null): Promise<boolean> {
  const db = await obtenerDB();
  const fila = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM solicitudes WHERE creada_en >= datetime('now', '-10 minutes')) AS general,
         (SELECT COUNT(*) FROM solicitudes WHERE ip = ? AND creada_en >= datetime('now', '-10 minutes')) AS de_esta_ip`,
    )
    .bind(ip)
    .first<{ general: number; de_esta_ip: number }>();

  if (!fila) return false;
  return fila.general >= MAX_GENERAL || (ip !== null && fila.de_esta_ip >= MAX_POR_IP);
}

export async function guardarSolicitud(lead: Lead, ip: string | null): Promise<number> {
  const db = await obtenerDB();
  const fila = await db
    .prepare(
      `INSERT INTO solicitudes (variante, nombre, email, telefono, tipo, comuna, motivo, fecha, mensaje, propiedad, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(
      varianteDe(lead.variante),
      lead.nombre,
      lead.email,
      lead.telefono,
      lead.tipo,
      lead.comuna,
      lead.motivo,
      lead.fecha,
      lead.mensaje,
      lead.propiedad,
      ip,
    )
    .first<{ id: number }>();
  return fila!.id;
}

/** Anota qué pasó con el aviso por correo de una solicitud ya guardada. */
export async function marcarCorreo(id: number, estado: EstadoCorreo): Promise<void> {
  const db = await obtenerDB();
  await db.prepare(`UPDATE solicitudes SET correo = ? WHERE id = ?`).bind(estado, id).run();
}

type Fila = Omit<Solicitud, 'creadaEn'> & { creada_en: string };

/** Las más nuevas primero. La ip no sale de la base: el panel no la necesita. */
export async function solicitudesRecientes(limite = 200): Promise<Solicitud[]> {
  const db = await obtenerDB();
  const { results } = await db
    .prepare(
      `SELECT id, variante, nombre, email, telefono, tipo, comuna, motivo, fecha, mensaje, propiedad, correo, creada_en
       FROM solicitudes ORDER BY creada_en DESC, id DESC LIMIT ?`,
    )
    .bind(limite)
    .all<Fila>();
  return results.map(({ creada_en, ...resto }) => ({ ...resto, creadaEn: creada_en }));
}

/** Devuelve false si no existía. */
export async function eliminarSolicitud(id: number): Promise<boolean> {
  const db = await obtenerDB();
  const fila = await db.prepare(`DELETE FROM solicitudes WHERE id = ? RETURNING id`).bind(id).first<{ id: number }>();
  return !!fila;
}
