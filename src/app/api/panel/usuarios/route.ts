import {
  errorJson,
  esAdmin,
  formatearRut,
  generarClaveTemporal,
  hashPassword,
  ipDe,
  json,
  normalizarRut,
  obtenerDB,
  registrar,
  sesionDeRequest,
  validarRut,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ROLES = ['ADMIN', 'EDITOR'] as const;

export async function POST(request: Request) {
  const sesion = await sesionDeRequest(request);
  if (!sesion) return errorJson('No autenticado', 401);
  if (!esAdmin(sesion.rol)) return errorJson('No tienes permiso para crear usuarios', 403);
  if (sesion.password_temporal) return errorJson('Primero cambia tu contraseña', 403);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorJson('Solicitud inválida', 400);
  }

  const rut = normalizarRut(body.rut);
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim().slice(0, 120) : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 160) : '';
  const rol = typeof body.rol === 'string' ? body.rol : '';

  if (!validarRut(rut)) return errorJson('El RUT no es válido', 422);
  if (nombre.length < 2) return errorJson('Escribe el nombre', 422);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return errorJson('El correo no es válido', 422);
  if (!ROLES.includes(rol as (typeof ROLES)[number])) return errorJson('El rol no es válido', 422);

  const db = await obtenerDB();
  const existe = await db.prepare(`SELECT id FROM usuarios WHERE rut_norm = ?`).bind(rut).first();
  if (existe) return errorJson('Ya hay una cuenta con ese RUT', 409);

  // Clave temporal de un uso: se muestra una vez y se cambia al entrar.
  const clave = generarClaveTemporal();
  const { hash, salt } = await hashPassword(clave);

  const creado = await db
    .prepare(
      `INSERT INTO usuarios (rut_norm, nombre, email, rol, password_hash, password_salt, password_temporal)
       VALUES (?, ?, ?, ?, ?, ?, 1) RETURNING id`,
    )
    .bind(rut, nombre, email || null, rol, hash, salt)
    .first<{ id: number }>();

  await registrar('USUARIO_CREADO', {
    usuarioId: sesion.usuario_id,
    detalle: { creado_id: creado?.id, rut: formatearRut(rut), rol },
    ip: ipDe(request),
  });

  return json({ ok: true, id: creado?.id, rut: formatearRut(rut), clave_temporal: clave }, 201);
}
