import { env } from 'cloudflare:workers';
import { COOKIE_SESION } from '@/lib/auth';
import { generarToken, hashToken } from '@/lib/crypto';

// Armado de sesiones para probar los endpoints del panel. No pasa por el
// login: crea la fila de usuarios y la de sesiones a mano, con el mismo
// SHA-256 del token que usa auth.ts, que es lo que después busca en la base.
//
// La contraseña no se verifica nunca en estas pruebas, así que el hash y el
// salt son de relleno: evita gastar 100.000 iteraciones de PBKDF2 por prueba.

type Opciones = {
  rol?: 'ADMIN' | 'EDITOR';
  claveTemporal?: boolean;
  activo?: boolean;
  expirada?: boolean;
};

let correlativo = 0;

export async function sesionDePrueba(opciones: Opciones = {}) {
  const { rol = 'ADMIN', claveTemporal = false, activo = true, expirada = false } = opciones;
  correlativo += 1;

  const usuario = await env.DB.prepare(
    `INSERT INTO usuarios (rut_norm, nombre, rol, password_hash, password_salt, password_temporal, activo)
     VALUES (?, ?, ?, 'hash-de-relleno', 'salt-de-relleno', ?, ?) RETURNING id`,
  )
    .bind(`1111111${correlativo}`, `Persona ${correlativo}`, rol, claveTemporal ? 1 : 0, activo ? 1 : 0)
    .first<{ id: number }>();

  const token = generarToken();
  await env.DB.prepare(
    `INSERT INTO sesiones (token, usuario_id, expira_en) VALUES (?, ?, datetime('now', ?))`,
  )
    .bind(await hashToken(token), usuario!.id, expirada ? '-1 day' : '+7 days')
    .run();

  return { usuarioId: usuario!.id, token, cookie: `${COOKIE_SESION}=${token}` };
}

/** Request con la cookie de sesión ya puesta. */
export function pedir(url: string, cookie: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set('Cookie', cookie);
  return new Request(`http://localhost${url}`, { ...init, headers });
}

export const comoJson = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
