import {
  cerrarSesionesDe,
  cookieSesion,
  crearSesion,
  errorJson,
  hashPassword,
  ipDe,
  json,
  obtenerDB,
  registrar,
  sesionDeRequest,
  validarPassword,
  verifyPassword,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const sesion = await sesionDeRequest(request);
  if (!sesion) return errorJson('No autenticado', 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorJson('Solicitud inválida', 400);
  }

  const actual = typeof body.actual === 'string' ? body.actual : '';
  const nueva = typeof body.nueva === 'string' ? body.nueva : '';

  const politica = validarPassword(nueva);
  if (!politica.ok) return errorJson(politica.error, 422);
  if (nueva === actual) return errorJson('La contraseña nueva tiene que ser distinta de la actual', 422);

  const db = await obtenerDB();
  const usuario = await db
    .prepare(`SELECT password_hash, password_salt FROM usuarios WHERE id = ? AND activo = 1`)
    .bind(sesion.usuario_id)
    .first<{ password_hash: string; password_salt: string }>();

  if (!usuario || !(await verifyPassword(actual, usuario.password_hash, usuario.password_salt))) {
    await registrar('CLAVE_CAMBIO_FALLIDO', { usuarioId: sesion.usuario_id, ip: ipDe(request) });
    return errorJson('La contraseña actual no es correcta', 401);
  }

  const { hash, salt } = await hashPassword(nueva);
  await db
    .prepare(`UPDATE usuarios SET password_hash = ?, password_salt = ?, password_temporal = 0 WHERE id = ?`)
    .bind(hash, salt, sesion.usuario_id)
    .run();

  // Si alguien más tenía una sesión abierta con la clave vieja, se corta.
  // Después se abre una nueva para quien acaba de cambiarla.
  await cerrarSesionesDe(sesion.usuario_id);
  const token = await crearSesion(sesion.usuario_id, request);
  await registrar('CLAVE_CAMBIADA', { usuarioId: sesion.usuario_id, ip: ipDe(request) });

  return json({ ok: true }, 200, { 'Set-Cookie': cookieSesion(token, request) });
}
