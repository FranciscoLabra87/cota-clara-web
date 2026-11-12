import {
  cerrarSesionesDe,
  errorJson,
  esAdmin,
  generarClaveTemporal,
  hashPassword,
  ipDe,
  json,
  obtenerDB,
  registrar,
  sesionDeRequest,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const sesion = await sesionDeRequest(request);
  if (!sesion) return errorJson('No autenticado', 401);
  if (!esAdmin(sesion.rol)) return errorJson('No tienes permiso para resetear contraseñas', 403);
  if (sesion.password_temporal) return errorJson('Primero cambia tu contraseña', 403);

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return errorJson('Usuario no válido', 400);

  const db = await obtenerDB();
  const usuario = await db.prepare(`SELECT id, nombre FROM usuarios WHERE id = ?`).bind(id).first<{ id: number; nombre: string }>();
  if (!usuario) return errorJson('No existe ese usuario', 404);

  const clave = generarClaveTemporal();
  const { hash, salt } = await hashPassword(clave);

  await db
    .prepare(
      `UPDATE usuarios SET password_hash = ?, password_salt = ?, password_temporal = 1,
              intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?`,
    )
    .bind(hash, salt, id)
    .run();

  // La clave vieja ya no sirve: las sesiones abiertas con ella tampoco.
  await cerrarSesionesDe(id);
  await registrar('CLAVE_RESETEADA', { usuarioId: sesion.usuario_id, detalle: { objetivo_id: id }, ip: ipDe(request) });

  return json({ ok: true, nombre: usuario.nombre, clave_temporal: clave });
}
