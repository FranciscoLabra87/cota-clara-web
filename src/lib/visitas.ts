import { obtenerDB } from './db';

// Contador de visitas de las fichas públicas. Suma por propiedad y por día,
// sin guardar nada de quién visitó: ni ip, ni navegador, ni cookies.

const DIA_CHILE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' });

/** El día en Chile, como YYYY-MM-DD. Lo que pasa a las 22:00 cuenta para hoy, no para mañana. */
export const diaDeChile = (fecha = new Date()) => DIA_CHILE.format(fecha);

// Tope de visitas contadas por día, sumando todas las propiedades. El
// endpoint es público y cada visita escribe en la base: sin tope, un script
// podría gastar la cuota diaria de escrituras de D1, y con ella se caerían
// también el formulario de contacto y el panel. Pasado el tope, las visitas
// de ese día dejan de sumarse y lo demás sigue funcionando.
export const MAX_VISITAS_POR_DIA = 20_000;

/**
 * Suma una visita a la ficha de ese slug, si está publicada. Devuelve si se
 * contó. Un slug que no existe, un borrador o el tope del día no cuentan.
 */
export async function contarVisita(slug: string, dia = diaDeChile()): Promise<boolean> {
  const db = await obtenerDB();
  const resultado = await db
    .prepare(
      `INSERT INTO propiedad_visitas (propiedad_id, dia, total)
       SELECT id, ?1, 1 FROM propiedades
       WHERE slug = ?2 AND estado = 'PUBLICADA'
         AND (SELECT COALESCE(SUM(total), 0) FROM propiedad_visitas WHERE dia = ?1) < ?3
       ON CONFLICT (propiedad_id, dia) DO UPDATE SET total = total + 1`,
    )
    .bind(dia, slug, MAX_VISITAS_POR_DIA)
    .run();
  return (resultado.meta.changes ?? 0) > 0;
}

export type Visitas = { total: number; semana: number };

/** Visitas de cada propiedad: el total histórico y las de los últimos 7 días, hoy incluido. */
export async function visitasPorPropiedad(hoy = new Date()): Promise<Map<number, Visitas>> {
  const desde = diaDeChile(new Date(hoy.getTime() - 6 * 24 * 60 * 60 * 1000));
  const db = await obtenerDB();
  const { results } = await db
    .prepare(
      `SELECT propiedad_id, SUM(total) AS total, SUM(CASE WHEN dia >= ? THEN total ELSE 0 END) AS semana
       FROM propiedad_visitas GROUP BY propiedad_id`,
    )
    .bind(desde)
    .all<{ propiedad_id: number; total: number; semana: number }>();
  return new Map(results.map((f) => [f.propiedad_id, { total: f.total, semana: f.semana }]));
}
