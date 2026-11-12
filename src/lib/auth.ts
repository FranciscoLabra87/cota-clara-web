import { getCloudflareContext } from '@opennextjs/cloudflare';
import { cookies } from 'next/headers';
import { generarToken, hashToken } from './crypto';

// Sesiones y acceso a la base. Las funciones puras (hashing, RUT, política de
// contraseñas) viven en crypto.ts, que no importa nada de Next ni Cloudflare.
// Portado del sistema de AG Casco Histórico.

export {
  formatearRut,
  generarClaveTemporal,
  hashPassword,
  hashToken,
  normalizarRut,
  validarPassword,
  validarRut,
  verifyPassword,
} from './crypto';

export const COOKIE_SESION = 'cota_sesion';
export const DURACION_SESION_SEG = 60 * 60 * 24 * 7;

const MAX_SESIONES_POR_USUARIO = 5;

export type Rol = 'ADMIN' | 'EDITOR';

export type Sesion = {
  usuario_id: number;
  rut_norm: string;
  nombre: string;
  rol: Rol;
  password_temporal: number;
};

export async function obtenerDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

// ─── Respuestas ───

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function errorJson(mensaje: string, status = 400, extra: Record<string, unknown> = {}) {
  return json({ error: mensaje, ...extra }, status);
}

// ─── Cookies ───

function conexionSegura(request?: Request) {
  if (!request) return true;
  if (new URL(request.url).protocol === 'https:') return true;
  const proto = request.headers.get('X-Forwarded-Proto') || '';
  if (proto.split(',')[0]?.trim().toLowerCase() === 'https') return true;
  try {
    return JSON.parse(request.headers.get('CF-Visitor') || '{}').scheme === 'https';
  } catch {
    return false;
  }
}

function atributosCookie(request: Request | undefined, maxAgeSeg: number) {
  const secure = conexionSegura(request) ? '; Secure' : '';
  return `Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${maxAgeSeg}`;
}

export function cookieSesion(token: string, request?: Request, maxAgeSeg = DURACION_SESION_SEG) {
  return `${COOKIE_SESION}=${token}; ${atributosCookie(request, maxAgeSeg)}`;
}

export function cookieSesionBorrada(request?: Request) {
  return `${COOKIE_SESION}=; ${atributosCookie(request, 0)}`;
}

export function leerCookie(request: Request, nombre: string) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|; )${nombre}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// ─── Sesión ───

async function sesionPorToken(token: string | null): Promise<Sesion | null> {
  if (!token) return null;
  const db = await obtenerDB();
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

// Para route handlers, que tienen el Request a mano.
export async function sesionDeRequest(request: Request) {
  return sesionPorToken(leerCookie(request, COOKIE_SESION));
}

// Para Server Components (el guardia del panel).
export async function sesionActual() {
  const store = await cookies();
  return sesionPorToken(store.get(COOKIE_SESION)?.value ?? null);
}

export async function crearSesion(usuarioId: number, request: Request) {
  const db = await obtenerDB();
  const token = generarToken();

  await db
    .prepare(
      `INSERT INTO sesiones (token, usuario_id, ip, user_agent, expira_en)
       VALUES (?, ?, ?, ?, datetime('now', '+7 days'))`,
    )
    .bind(await hashToken(token), usuarioId, ipDe(request), request.headers.get('User-Agent'))
    .run();

  // Limpieza oportunista: las caducadas de todos, y las más viejas de este usuario.
  await db.batch([
    db.prepare(`DELETE FROM sesiones WHERE expira_en <= datetime('now')`),
    db
      .prepare(
        `DELETE FROM sesiones WHERE usuario_id = ? AND token NOT IN (
           SELECT token FROM sesiones WHERE usuario_id = ? ORDER BY creada_en DESC LIMIT ${MAX_SESIONES_POR_USUARIO}
         )`,
      )
      .bind(usuarioId, usuarioId),
  ]);

  return token;
}

export async function cerrarSesion(token: string) {
  const db = await obtenerDB();
  await db.prepare(`DELETE FROM sesiones WHERE token = ?`).bind(await hashToken(token)).run();
}

// Corta todas las sesiones del usuario. Se usa al cambiar o resetear la clave:
// si alguien tenía una sesión abierta con la anterior, deja de servir.
export async function cerrarSesionesDe(usuarioId: number) {
  const db = await obtenerDB();
  await db.prepare(`DELETE FROM sesiones WHERE usuario_id = ?`).bind(usuarioId).run();
}

// ─── Utilidades ───

export function ipDe(request: Request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || null;
}

export async function registrar(
  accion: string,
  datos: { usuarioId?: number | null; detalle?: unknown; ip?: string | null } = {},
) {
  try {
    const db = await obtenerDB();
    await db
      .prepare(`INSERT INTO log_eventos (usuario_id, accion, detalle, ip) VALUES (?, ?, ?, ?)`)
      .bind(datos.usuarioId ?? null, accion, datos.detalle ? JSON.stringify(datos.detalle) : null, datos.ip ?? null)
      .run();
  } catch (e) {
    console.error('[log] no se pudo registrar el evento:', e);
  }
}

export function esAdmin(rol: string) {
  return rol === 'ADMIN';
}
