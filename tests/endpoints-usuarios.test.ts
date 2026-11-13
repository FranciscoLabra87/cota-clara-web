import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';
import { comoJson, pedir, sesionDePrueba } from './sesion';

vi.mock('@/lib/db', () => ({
  obtenerDB: async () => env.DB,
  obtenerFotos: async () => env.FOTOS,
}));

const { POST: crearUsuario } = await import('../src/app/api/panel/usuarios/route');
const { POST: resetearClave } = await import('../src/app/api/panel/usuarios/[id]/reset-clave/route');
const { POST: cambiarEstadoUsuario } = await import('../src/app/api/panel/usuarios/[id]/estado/route');
const { POST: cambiarRol } = await import('../src/app/api/panel/usuarios/[id]/rol/route');
const { validarPassword, verifyPassword } = await import('@/lib/crypto');

const ruta = (id: string | number) => ({ params: Promise.resolve({ id: String(id) }) });

const nuevo = (extra: Record<string, unknown> = {}) => ({
  rut: '12.345.670-K',
  nombre: 'Gustavo',
  rol: 'EDITOR',
  ...extra,
});

const crear = (cookie: string | null, body: Record<string, unknown> = nuevo()) =>
  crearUsuario(pedir('/api/panel/usuarios', cookie, comoJson(body)));

describe('quién puede administrar cuentas', () => {
  it('sin sesión, 401', async () => {
    expect((await crear(null)).status).toBe(401);
    expect((await resetearClave(pedir('/api/panel/usuarios/1/reset-clave', null, comoJson({})), ruta(1))).status).toBe(401);
    expect((await cambiarEstadoUsuario(pedir('/api/panel/usuarios/1/estado', null, comoJson({ activo: false })), ruta(1))).status).toBe(401);
  });

  it('un editor no administra cuentas: 403', async () => {
    const { cookie } = await sesionDePrueba({ rol: 'EDITOR' });
    expect((await crear(cookie)).status).toBe(403);
    expect((await resetearClave(pedir('/api/panel/usuarios/1/reset-clave', cookie, comoJson({})), ruta(1))).status).toBe(403);
  });

  it('un admin con la clave temporal sin cambiar tampoco', async () => {
    const { cookie } = await sesionDePrueba({ claveTemporal: true });
    expect((await crear(cookie)).status).toBe(403);
  });
});

describe('crear una cuenta', () => {
  it('la crea con una clave temporal que sirve para entrar y hay que cambiar', async () => {
    const { cookie } = await sesionDePrueba();
    const res = await crear(cookie);
    expect(res.status).toBe(201);

    const cuerpo = (await res.json()) as { id: number; rut: string; clave_temporal: string };
    expect(cuerpo.rut).toBe('12.345.670-K');
    expect(validarPassword(cuerpo.clave_temporal).ok).toBe(true);

    const fila = await env.DB.prepare('SELECT rut_norm, rol, password_temporal, password_hash, password_salt FROM usuarios WHERE id = ?')
      .bind(cuerpo.id)
      .first<{ rut_norm: string; rol: string; password_temporal: number; password_hash: string; password_salt: string }>();

    expect(fila!.rut_norm).toBe('12345670K');
    expect(fila!.rol).toBe('EDITOR');
    expect(fila!.password_temporal).toBe(1);
    // En la base va el hash, no la clave.
    expect(fila!.password_hash).not.toBe(cuerpo.clave_temporal);
    expect(await verifyPassword(cuerpo.clave_temporal, fila!.password_hash, fila!.password_salt)).toBe(true);
  });

  it('cada cuenta nueva estrena su propia clave', async () => {
    const { cookie } = await sesionDePrueba();
    const una = (await (await crear(cookie)).json()) as { clave_temporal: string };
    const otra = (await (await crear(cookie, nuevo({ rut: '11.111.111-1' }))).json()) as { clave_temporal: string };
    expect(una.clave_temporal).not.toBe(otra.clave_temporal);
  });

  it('valida el RUT, el nombre, el correo y el rol', async () => {
    const { cookie } = await sesionDePrueba();
    expect((await crear(cookie, nuevo({ rut: '12.345.670-9' }))).status).toBe(422);
    expect((await crear(cookie, nuevo({ nombre: 'G' }))).status).toBe(422);
    expect((await crear(cookie, nuevo({ email: 'no-es-un-correo' }))).status).toBe(422);
    expect((await crear(cookie, nuevo({ rol: 'DUEÑO' }))).status).toBe(422);
  });

  it('no deja dos cuentas con el mismo RUT', async () => {
    const { cookie } = await sesionDePrueba();
    await crear(cookie);
    expect((await crear(cookie)).status).toBe(409);
  });
});

describe('resetear una clave', () => {
  it('entrega una clave nueva, la marca de temporal y corta las sesiones de esa persona', async () => {
    const { cookie } = await sesionDePrueba();
    const otra = await sesionDePrueba({ rol: 'EDITOR' });

    const res = await resetearClave(pedir(`/api/panel/usuarios/${otra.usuarioId}/reset-clave`, cookie, comoJson({})), ruta(otra.usuarioId));
    expect(res.status).toBe(200);

    const cuerpo = (await res.json()) as { clave_temporal: string };
    expect(validarPassword(cuerpo.clave_temporal).ok).toBe(true);

    const fila = await env.DB.prepare('SELECT password_temporal, intentos_fallidos FROM usuarios WHERE id = ?')
      .bind(otra.usuarioId)
      .first<{ password_temporal: number; intentos_fallidos: number }>();
    expect(fila!.password_temporal).toBe(1);
    expect(fila!.intentos_fallidos).toBe(0);

    const sesiones = await env.DB.prepare('SELECT COUNT(*) AS n FROM sesiones WHERE usuario_id = ?')
      .bind(otra.usuarioId)
      .first<{ n: number }>();
    expect(sesiones!.n).toBe(0);
  });

  it('404 si no existe y 400 si el id no sirve', async () => {
    const { cookie } = await sesionDePrueba();
    expect((await resetearClave(pedir('/api/panel/usuarios/9999/reset-clave', cookie, comoJson({})), ruta(9999))).status).toBe(404);
    expect((await resetearClave(pedir('/api/panel/usuarios/abc/reset-clave', cookie, comoJson({})), ruta('abc'))).status).toBe(400);
  });
});

describe('activar y desactivar', () => {
  const estado = (cookie: string, id: number, activo: unknown) =>
    cambiarEstadoUsuario(pedir(`/api/panel/usuarios/${id}/estado`, cookie, comoJson({ activo })), ruta(id));

  it('desactivar cierra las sesiones de esa cuenta', async () => {
    const { cookie } = await sesionDePrueba();
    const otra = await sesionDePrueba({ rol: 'EDITOR' });

    expect((await estado(cookie, otra.usuarioId, false)).status).toBe(200);
    const sesiones = await env.DB.prepare('SELECT COUNT(*) AS n FROM sesiones WHERE usuario_id = ?')
      .bind(otra.usuarioId)
      .first<{ n: number }>();
    expect(sesiones!.n).toBe(0);
  });

  it('nadie puede desactivarse a sí mismo', async () => {
    const { cookie, usuarioId } = await sesionDePrueba();
    const res = await estado(cookie, usuarioId, false);
    expect(res.status).toBe(409);
  });

  it('se puede desactivar a otro administrador mientras uno siga activo', async () => {
    const admin = await sesionDePrueba();
    const otro = await sesionDePrueba({ rol: 'ADMIN' });
    expect((await estado(admin.cookie, otro.usuarioId, false)).status).toBe(200);
  });

  it('el panel nunca queda sin administrador activo', async () => {
    const admin = await sesionDePrueba();
    const otro = await sesionDePrueba({ rol: 'ADMIN' });
    await estado(admin.cookie, otro.usuarioId, false);

    // Queda uno solo, y es quien está pidiendo el cambio: lo corta la regla
    // de no desactivarse a sí mismo. Por eso el chequeo de "que quede al
    // menos un ADMIN" del endpoint no se alcanza a gatillar desde la API.
    const res = await estado(admin.cookie, admin.usuarioId, false);
    expect(res.status).toBe(409);

    const fila = await env.DB.prepare('SELECT activo FROM usuarios WHERE id = ?').bind(admin.usuarioId).first<{ activo: number }>();
    expect(fila!.activo).toBe(1);
  });

  it('exige que activo sea booleano', async () => {
    const { cookie } = await sesionDePrueba();
    const otra = await sesionDePrueba({ rol: 'EDITOR' });
    expect((await estado(cookie, otra.usuarioId, 'si')).status).toBe(422);
  });

  it('404 si la cuenta no existe', async () => {
    const { cookie } = await sesionDePrueba();
    expect((await estado(cookie, 9999, false)).status).toBe(404);
  });
});

describe('cambiar el rol', () => {
  const rol = (cookie: string | null, id: number | string, cuerpo: unknown) =>
    cambiarRol(pedir(`/api/panel/usuarios/${id}/rol`, cookie, comoJson(cuerpo)), ruta(id));

  const rolDe = async (id: number) =>
    (await env.DB.prepare('SELECT rol FROM usuarios WHERE id = ?').bind(id).first<{ rol: string }>())!.rol;

  it('un administrador puede subir a un editor', async () => {
    const { cookie } = await sesionDePrueba();
    const editor = await sesionDePrueba({ rol: 'EDITOR' });

    const res = await rol(cookie, editor.usuarioId, { rol: 'ADMIN' });
    expect(res.status).toBe(200);
    expect(await rolDe(editor.usuarioId)).toBe('ADMIN');
  });

  it('y bajar a otro administrador, que ve el cambio sin volver a entrar', async () => {
    const { cookie } = await sesionDePrueba();
    const otro = await sesionDePrueba({ rol: 'ADMIN' });

    expect((await rol(cookie, otro.usuarioId, { rol: 'EDITOR' })).status).toBe(200);
    expect(await rolDe(otro.usuarioId)).toBe('EDITOR');

    // Su sesión sigue abierta, pero ya no puede administrar cuentas.
    expect((await crear(otro.cookie)).status).toBe(403);
  });

  it('nadie puede cambiar su propio rol', async () => {
    const { cookie, usuarioId } = await sesionDePrueba();
    expect((await rol(cookie, usuarioId, { rol: 'EDITOR' })).status).toBe(409);
    expect(await rolDe(usuarioId)).toBe('ADMIN');
  });

  it('un editor no cambia roles, ni el suyo', async () => {
    const editor = await sesionDePrueba({ rol: 'EDITOR' });
    const otro = await sesionDePrueba({ rol: 'EDITOR' });
    expect((await rol(editor.cookie, otro.usuarioId, { rol: 'ADMIN' })).status).toBe(403);
    expect((await rol(editor.cookie, editor.usuarioId, { rol: 'ADMIN' })).status).toBe(403);
    expect(await rolDe(editor.usuarioId)).toBe('EDITOR');
  });

  it('sin sesión 401, y con la clave temporal pendiente 403', async () => {
    const editor = await sesionDePrueba({ rol: 'EDITOR' });
    expect((await rol(null, editor.usuarioId, { rol: 'ADMIN' })).status).toBe(401);

    const { cookie } = await sesionDePrueba({ claveTemporal: true });
    expect((await rol(cookie, editor.usuarioId, { rol: 'ADMIN' })).status).toBe(403);
    expect(await rolDe(editor.usuarioId)).toBe('EDITOR');
  });

  it('rechaza un rol inventado, una cuenta que no existe y un id que no sirve', async () => {
    const { cookie } = await sesionDePrueba();
    const editor = await sesionDePrueba({ rol: 'EDITOR' });
    expect((await rol(cookie, editor.usuarioId, { rol: 'DUEÑO' })).status).toBe(422);
    expect((await rol(cookie, editor.usuarioId, {})).status).toBe(422);
    expect((await rol(cookie, 9999, { rol: 'ADMIN' })).status).toBe(404);
    expect((await rol(cookie, 'abc', { rol: 'ADMIN' })).status).toBe(400);
  });

  it('queda en la bitácora quién lo cambió, de qué a qué', async () => {
    const { cookie, usuarioId } = await sesionDePrueba();
    const editor = await sesionDePrueba({ rol: 'EDITOR' });
    await rol(cookie, editor.usuarioId, { rol: 'ADMIN' });

    const evento = await env.DB.prepare("SELECT usuario_id, detalle FROM log_eventos WHERE accion = 'ROL_CAMBIADO'").first<{
      usuario_id: number;
      detalle: string;
    }>();
    expect(evento!.usuario_id).toBe(usuarioId);
    expect(JSON.parse(evento!.detalle)).toEqual({ objetivo_id: editor.usuarioId, antes: 'EDITOR', rol: 'ADMIN' });
  });

  it('pedir el rol que ya tiene no hace nada ni deja rastro', async () => {
    const { cookie } = await sesionDePrueba();
    const editor = await sesionDePrueba({ rol: 'EDITOR' });
    expect((await rol(cookie, editor.usuarioId, { rol: 'EDITOR' })).status).toBe(200);
    const eventos = await env.DB.prepare("SELECT COUNT(*) AS n FROM log_eventos WHERE accion = 'ROL_CAMBIADO'").first<{ n: number }>();
    expect(eventos!.n).toBe(0);
  });
});
