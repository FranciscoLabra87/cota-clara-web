import {
  cookieSesion,
  crearSesion,
  errorJson,
  hashPassword,
  ipDe,
  json,
  normalizarRut,
  obtenerDB,
  registrar,
  verifyPassword,
} from '@/lib/auth';
import { verificarTurnstile } from '@/lib/turnstile';

export const dynamic = 'force-dynamic';

// La cuenta se bloquea a los 5 fallos, pero eso no frena a quien prueba una
// contraseña común contra muchos RUT distintos: este tope corta por conexión.
const LIMITE_FALLOS_POR_IP = 20;
const BLOQUEO_TRAS_FALLOS = 5;

// Salt de descarte con el mismo formato que produce hashPassword. Sirve para
// gastar el mismo tiempo de PBKDF2 cuando el RUT no existe, y así no delatar
// qué RUT están registrados.
const SALT_DESCARTE = '00000000000000000000000000000000';

type FilaUsuario = {
  id: number;
  nombre: string;
  rol: string;
  password_hash: string;
  password_salt: string;
  password_temporal: number;
  intentos_fallidos: number;
  bloqueado_hasta: string | null;
};

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorJson('Solicitud inválida', 400);
  }

  const rut = normalizarRut(body.rut);
  const password = typeof body.password === 'string' ? body.password : '';
  const ip = ipDe(request);

  if (!rut || !password) return errorJson('Faltan el RUT o la contraseña');
  if (rut.length > 12 || password.length > 128) return errorJson('Credenciales inválidas', 400);

  const turnstile = await verificarTurnstile(request, body.turnstile_token);
  if (!turnstile.ok) return errorJson(turnstile.mensaje, turnstile.status);

  const db = await obtenerDB();

  if (ip) {
    const recientes = await db
      .prepare(
        `SELECT COUNT(*) AS total FROM log_eventos
         WHERE accion = 'LOGIN_FAIL' AND ip = ? AND fecha >= datetime('now', '-15 minutes')`,
      )
      .bind(ip)
      .first<{ total: number }>();
    if (Number(recientes?.total || 0) >= LIMITE_FALLOS_POR_IP) {
      return errorJson('Demasiados intentos fallidos desde esta conexión. Intenta en 15 minutos.', 429);
    }
  }

  const usuario = await db
    .prepare(
      `SELECT id, nombre, rol, password_hash, password_salt, password_temporal,
              intentos_fallidos, bloqueado_hasta
       FROM usuarios WHERE rut_norm = ? AND activo = 1`,
    )
    .bind(rut)
    .first<FilaUsuario>();

  if (!usuario) {
    // Mismo trabajo de PBKDF2 que en el camino con usuario real: un RUT
    // inexistente no se distingue ni por tiempo ni por el freno por IP.
    await hashPassword(password, SALT_DESCARTE);
    await registrar('LOGIN_FAIL', { detalle: { motivo: 'RUT_DESCONOCIDO' }, ip });
    return errorJson('RUT o contraseña incorrectos', 401);
  }

  if (usuario.bloqueado_hasta && new Date(`${usuario.bloqueado_hasta}Z`) > new Date()) {
    return errorJson('Cuenta temporalmente bloqueada. Intenta nuevamente en 15 minutos.', 429);
  }

  const clave = await verifyPassword(password, usuario.password_hash, usuario.password_salt);
  if (!clave) {
    const intentos = (usuario.intentos_fallidos || 0) + 1;
    await db
      .prepare(
        intentos >= BLOQUEO_TRAS_FALLOS
          ? `UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = datetime('now', '+15 minutes') WHERE id = ?`
          : `UPDATE usuarios SET intentos_fallidos = ? WHERE id = ?`,
      )
      .bind(intentos, usuario.id)
      .run();
    await registrar('LOGIN_FAIL', { usuarioId: usuario.id, detalle: { intentos }, ip });
    return errorJson('RUT o contraseña incorrectos', 401);
  }

  await db
    .prepare(`UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_login = datetime('now') WHERE id = ?`)
    .bind(usuario.id)
    .run();

  const token = await crearSesion(usuario.id, request);
  await registrar('LOGIN_OK', { usuarioId: usuario.id, ip });

  return json(
    {
      ok: true,
      usuario: { nombre: usuario.nombre, rol: usuario.rol },
      debe_cambiar_clave: !!usuario.password_temporal,
    },
    200,
    { 'Set-Cookie': cookieSesion(token, request) },
  );
}
