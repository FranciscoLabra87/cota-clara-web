import { cerrarSesionesDe, errorJson, esAdmin, ipDe, json, obtenerDB, registrar, sesionDeRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const sesion = await sesionDeRequest(request);
  if (!sesion) return errorJson('No autenticado', 401);
  if (!esAdmin(sesion.rol)) return errorJson('No tienes permiso para cambiar el estado de un usuario', 403);
  if (sesion.password_temporal) return errorJson('Primero cambia tu contraseña', 403);

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return errorJson('Usuario no válido', 400);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorJson('Solicitud inválida', 400);
  }
  if (typeof body.activo !== 'boolean') return errorJson('Indica si la cuenta queda activa o no', 422);
  const activo = body.activo;

  // Desactivarse a uno mismo deja el panel sin nadie adentro.
  if (!activo && id === sesion.usuario_id) return errorJson('No puedes desactivar tu propia cuenta', 409);

  const db = await obtenerDB();
  const usuario = await db
    .prepare(`SELECT id, nombre, rol, activo FROM usuarios WHERE id = ?`)
    .bind(id)
    .first<{ id: number; nombre: string; rol: string; activo: number }>();
  if (!usuario) return errorJson('No existe ese usuario', 404);

  // Sin ningún ADMIN activo nadie podría volver a entrar a administrar.
  if (!activo && usuario.rol === 'ADMIN') {
    const otros = await db
      .prepare(`SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'ADMIN' AND activo = 1 AND id <> ?`)
      .bind(id)
      .first<{ total: number }>();
    if (Number(otros?.total || 0) === 0) return errorJson('Tiene que quedar al menos un administrador activo', 409);
  }

  await db.prepare(`UPDATE usuarios SET activo = ? WHERE id = ?`).bind(activo ? 1 : 0, id).run();
  if (!activo) await cerrarSesionesDe(id);

  await registrar(activo ? 'USUARIO_ACTIVADO' : 'USUARIO_DESACTIVADO', {
    usuarioId: sesion.usuario_id,
    detalle: { objetivo_id: id },
    ip: ipDe(request),
  });

  return json({ ok: true, activo });
}
