import { obtenerDB } from './db';
import type { EnvioLead, Lead } from './leads';

// Registro de las solicitudes que llegan por los formularios del sitio.
// El correo es solo el aviso: lo que no se puede perder queda acá.

export type Variante = 'contacto' | 'tasacion' | 'visita';
export type EstadoCorreo = 'pendiente' | EnvioLead['estado'];
export type EstadoGestion = 'pendiente' | 'enviando' | 'error' | 'respondida';

export type Solicitud = Omit<Lead, 'variante'> & {
  id: number;
  variante: Variante;
  correo: EstadoCorreo;
  estado: EstadoGestion;
  respuestaTexto: string;
  notaRespuesta: string;
  respuestaEmailId: string | null;
  respuestaIntentadaEn: string | null;
  respondidaEn: string | null;
  respondidaPorNombre: string | null;
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

// La ip solo sirve para el tope, que mira los últimos diez minutos. Guardarla
// más allá de eso es acumular un dato personal que nadie usa, así que se
// borra pasado un día. Se aprovecha cada solicitud nueva para hacerlo.
const LIMPIAR_IPS = `UPDATE solicitudes SET ip = NULL WHERE ip IS NOT NULL AND creada_en < datetime('now', '-1 day')`;

export async function guardarSolicitud(lead: Lead, ip: string | null): Promise<number> {
  const db = await obtenerDB();
  const [insercion] = await db.batch<{ id: number }>([
    db
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
      ),
    db.prepare(LIMPIAR_IPS),
  ]);
  return insercion.results[0].id;
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
      `SELECT s.id, s.variante, s.nombre, s.email, s.telefono, s.tipo, s.comuna, s.motivo, s.fecha, s.mensaje,
              s.propiedad, s.correo, s.estado, s.respuesta_texto AS respuestaTexto, s.nota_respuesta AS notaRespuesta,
              s.respuesta_email_id AS respuestaEmailId, s.respuesta_intentada_en AS respuestaIntentadaEn,
              s.respondida_en AS respondidaEn, u.nombre AS respondidaPorNombre, s.creada_en
       FROM solicitudes s LEFT JOIN usuarios u ON u.id = s.respondida_por
       ORDER BY s.creada_en DESC, s.id DESC LIMIT ?`,
    )
    .bind(limite)
    .all<Fila>();
  return results.map(({ creada_en, ...resto }) => ({ ...resto, creadaEn: creada_en }));
}

export type SolicitudParaEnvio = Pick<Solicitud, 'id' | 'variante' | 'nombre' | 'email'> & {
  respuesta: string;
  clave: string;
};

/** Reserva atómicamente un ticket nuevo: dos personas no pueden enviar la misma respuesta. */
export async function prepararRespuesta(id: number, usuarioId: number, respuesta: string, nota: string): Promise<SolicitudParaEnvio | null> {
  const db = await obtenerDB();
  const clave = `solicitud-${id}-${crypto.randomUUID()}`;
  return db
    .prepare(
      `UPDATE solicitudes
       SET estado = 'enviando', respuesta_texto = ?, nota_respuesta = ?, respuesta_clave = ?,
           respuesta_intentada_en = datetime('now'), respondida_por = ?
       WHERE id = ? AND estado = 'pendiente'
       RETURNING id, variante, nombre, email, respuesta_texto AS respuesta, respuesta_clave AS clave`,
    )
    .bind(respuesta, nota, clave, usuarioId, id)
    .first<SolicitudParaEnvio>();
}

/** Reintenta el mismo contenido y la misma clave; nunca permite editar un envío incierto. */
export async function reintentarRespuesta(id: number): Promise<SolicitudParaEnvio | null> {
  const db = await obtenerDB();
  return db
    .prepare(
      `UPDATE solicitudes SET estado = 'enviando', respuesta_intentada_en = datetime('now')
       WHERE id = ? AND respuesta_clave IS NOT NULL
         AND (estado = 'error' OR (estado = 'enviando'
           AND respuesta_intentada_en <= datetime('now', '-2 minutes')
           AND respuesta_intentada_en >= datetime('now', '-23 hours')))
       RETURNING id, variante, nombre, email, respuesta_texto AS respuesta, respuesta_clave AS clave`,
    )
    .bind(id)
    .first<SolicitudParaEnvio>();
}

export async function solicitudExiste(id: number): Promise<boolean> {
  const db = await obtenerDB();
  return !!(await db.prepare(`SELECT id FROM solicitudes WHERE id = ?`).bind(id).first());
}

export async function marcarRespuestaEnviada(id: number, clave: string, emailId: string): Promise<boolean> {
  const db = await obtenerDB();
  return !!(await db
    .prepare(
      `UPDATE solicitudes SET estado = 'respondida', respuesta_email_id = ?, respondida_en = datetime('now')
       WHERE id = ? AND estado = 'enviando' AND respuesta_clave = ? RETURNING id`,
    )
    .bind(emailId, id, clave)
    .first());
}

export async function marcarRespuestaFallida(id: number, clave: string): Promise<void> {
  const db = await obtenerDB();
  await db
    .prepare(`UPDATE solicitudes SET estado = 'error' WHERE id = ? AND estado = 'enviando' AND respuesta_clave = ?`)
    .bind(id, clave)
    .run();
}

/** Durante el envío no se borra: el destinatario y la nota deben quedar hasta conocer el resultado. */
export async function eliminarSolicitud(id: number): Promise<'eliminada' | 'enviando' | 'no-existe'> {
  const db = await obtenerDB();
  const fila = await db.prepare(`DELETE FROM solicitudes WHERE id = ? AND estado != 'enviando' RETURNING id`).bind(id).first<{ id: number }>();
  if (fila) return 'eliminada';
  return (await solicitudExiste(id)) ? 'enviando' : 'no-existe';
}
