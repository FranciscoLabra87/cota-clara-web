import { errorJson, esAdmin, ipDe, json, obtenerDB, registrar, sesionDeRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const ROLES = ['ADMIN', 'EDITOR'] as const;
type Rol = (typeof ROLES)[number];

// Cambia el rol de otra cuenta. El cambio rige en la siguiente acción de esa
// persona, sin cerrarle la sesión: el rol se lee de la base en cada request.
export async function POST(request: Request, { params }: Params) {
  const sesion = await sesionDeRequest(request);
  if (!sesion) return errorJson('No autenticado', 401);
  if (!esAdmin(sesion.rol)) return errorJson('No tienes permiso para cambiar roles', 403);
  if (sesion.password_temporal) return errorJson('Primero cambia tu contraseña', 403);

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return errorJson('Usuario no válido', 400);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorJson('Solicitud inválida', 400);
  }
  const rol = body.rol;
  if (typeof rol !== 'string' || !ROLES.includes(rol as Rol)) return errorJson('El rol no es válido', 422);

  // El propio rol no se toca: un administrador que se baja a editor por error
  // ya no puede deshacerlo. Y como quien pide el cambio es un administrador
  // activo, con esta regla el panel nunca se queda sin administradores.
  if (id === sesion.usuario_id) return errorJson('No puedes cambiar tu propio rol', 409);

  const db = await obtenerDB();
  const usuario = await db.prepare(`SELECT id, rol FROM usuarios WHERE id = ?`).bind(id).first<{ id: number; rol: Rol }>();
  if (!usuario) return errorJson('No existe ese usuario', 404);
  if (usuario.rol === rol) return json({ ok: true, rol });

  await db.prepare(`UPDATE usuarios SET rol = ? WHERE id = ?`).bind(rol, id).run();
  await registrar('ROL_CAMBIADO', {
    usuarioId: sesion.usuario_id,
    detalle: { objetivo_id: id, antes: usuario.rol, rol },
    ip: ipDe(request),
  });

  return json({ ok: true, rol });
}
