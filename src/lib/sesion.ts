import { hashToken } from './crypto';

// Lectura de la sesión a partir de la cookie, sin nada de Next. Va aparte de
// auth.ts para que la use también el Worker propio (worker.ts), que atiende
// las subidas y descargas del Drive antes de que el pedido llegue a Next.
// Así hay una sola consulta de sesión para todo el sitio.

export const COOKIE_SESION = 'cota_sesion';

export type Rol = 'ADMIN' | 'EDITOR';

export type Sesion = {
  usuario_id: number;
  rut_norm: string;
  nombre: string;
  rol: Rol;
  password_temporal: number;
};

export function leerCookie(request: Request, nombre: string) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|; )${nombre}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** La sesión vigente de ese token, de una cuenta activa, o null. */
export async function sesionEnBase(db: D1Database, token: string | null): Promise<Sesion | null> {
  if (!token) return null;
  const fila = await db
    .prepare(
      `SELECT u.id AS usuario_id, u.rut_norm, u.nombre, u.rol, u.password_temporal
       FROM sesiones s
       JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token = ? AND s.expira_en > datetime('now') AND u.activo = 1`,
    )
    .bind(await hashToken(token))
    .first<Sesion>();
  return fila ?? null;
}

/** La sesión del pedido, leída de su cookie. */
export const sesionDelPedido = (db: D1Database, request: Request) => sesionEnBase(db, leerCookie(request, COOKIE_SESION));
