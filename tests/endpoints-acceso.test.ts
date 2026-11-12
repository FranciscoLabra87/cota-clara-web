import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pedir, sesionDePrueba } from './sesion';

vi.mock('@/lib/db', () => ({
  obtenerDB: async () => env.DB,
  obtenerFotos: async () => env.FOTOS,
}));

// Turnstile sale a pedirle a Cloudflare que valide el token, así que acá se
// reemplaza por su veredicto. Lo que se prueba es que el login lo respete.
const anti = vi.hoisted(() => ({
  bot: { ok: true } as { ok: true } | { ok: false; mensaje: string; status: number },
}));
vi.mock('@/lib/turnstile', () => ({
  ACCION_TURNSTILE: 'acceso-corporativo',
  siteKeyTurnstile: async () => null,
  verificarTurnstile: async () => anti.bot,
}));

const { POST: login } = await import('../src/app/api/auth/login/route');
const { POST: logout } = await import('../src/app/api/auth/logout/route');
const { POST: cambiarClave } = await import('../src/app/api/auth/cambiar-clave/route');
const { hashPassword, hashToken } = await import('@/lib/crypto');

const CLAVE = 'clave-de-prueba-1';
const RUT = '11.111.111-1';

async function usuario(extra: { claveTemporal?: boolean; activo?: boolean; clave?: string } = {}) {
  const { claveTemporal = false, activo = true, clave = CLAVE } = extra;
  const { hash, salt } = await hashPassword(clave);
  const fila = await env.DB.prepare(
    `INSERT INTO usuarios (rut_norm, nombre, rol, password_hash, password_salt, password_temporal, activo)
     VALUES ('111111111', 'Francisco', 'ADMIN', ?, ?, ?, ?) RETURNING id`,
  )
    .bind(hash, salt, claveTemporal ? 1 : 0, activo ? 1 : 0)
    .first<{ id: number }>();
  return fila!.id;
}

const entrar = (body: unknown, headers: Record<string, string> = {}) =>
  login(
    pedir('/api/auth/login', null, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  );

const contar = async (accion: string) =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM log_eventos WHERE accion = ?').bind(accion).first<{ n: number }>())!.n;

beforeEach(() => {
  anti.bot = { ok: true };
});

describe('entrar', () => {
  it('con el RUT y la clave correctos abre sesión', async () => {
    const id = await usuario();
    const res = await entrar({ rut: RUT, password: CLAVE });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, usuario: { nombre: 'Francisco', rol: 'ADMIN' }, debe_cambiar_clave: false });

    const sesiones = await env.DB.prepare('SELECT COUNT(*) AS n FROM sesiones WHERE usuario_id = ?').bind(id).first<{ n: number }>();
    expect(sesiones!.n).toBe(1);
    expect(await contar('LOGIN_OK')).toBe(1);
  });

  it('acepta el RUT con puntos, con guion y en minúscula', async () => {
    await usuario();
    for (const rut of ['11.111.111-1', '11111111-1', '111111111']) {
      expect((await entrar({ rut, password: CLAVE })).status).toBe(200);
    }
  });

  it('avisa cuando la clave es temporal, para mandar a cambiarla', async () => {
    await usuario({ claveTemporal: true });
    expect(await (await entrar({ rut: RUT, password: CLAVE })).json()).toMatchObject({ debe_cambiar_clave: true });
  });

  it('la cookie es HttpOnly y SameSite=Strict, y lleva Secure si la conexión es https', async () => {
    await usuario();

    const plano = (await entrar({ rut: RUT, password: CLAVE })).headers.get('Set-Cookie')!;
    expect(plano).toContain('HttpOnly');
    expect(plano).toContain('SameSite=Strict');
    expect(plano).toContain('Path=/');

    const seguro = (await entrar({ rut: RUT, password: CLAVE }, { 'X-Forwarded-Proto': 'https' })).headers.get('Set-Cookie')!;
    expect(seguro).toContain('Secure');
  });

  it('en la base queda el hash del token, nunca el token', async () => {
    await usuario();
    const cookie = (await entrar({ rut: RUT, password: CLAVE })).headers.get('Set-Cookie')!;
    const token = cookie.split(';')[0].split('=')[1];

    const guardado = await env.DB.prepare('SELECT token FROM sesiones').first<{ token: string }>();
    expect(guardado!.token).not.toBe(token);
    expect(guardado!.token).toBe(await hashToken(token));
  });
});

describe('no entrar', () => {
  it('con la clave equivocada no dice que el RUT existe', async () => {
    await usuario();
    const malaClave = await entrar({ rut: RUT, password: 'otra-clave-99' });
    const rutDesconocido = await entrar({ rut: '12.345.670-K', password: CLAVE });

    expect(malaClave.status).toBe(401);
    expect(rutDesconocido.status).toBe(401);
    expect(await malaClave.json()).toEqual(await rutDesconocido.json());
  });

  it('una cuenta desactivada se comporta como un RUT que no existe', async () => {
    await usuario({ activo: false });
    const res = await entrar({ rut: RUT, password: CLAVE });
    expect(res.status).toBe(401);
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM sesiones').first<{ n: number }>()).toMatchObject({ n: 0 });
  });

  it('bloquea la cuenta a los 5 intentos, incluso si después aciertan', async () => {
    const id = await usuario();
    for (let i = 0; i < 5; i += 1) {
      expect((await entrar({ rut: RUT, password: 'equivocada-1' })).status).toBe(401);
    }

    const fila = await env.DB.prepare('SELECT intentos_fallidos, bloqueado_hasta FROM usuarios WHERE id = ?')
      .bind(id)
      .first<{ intentos_fallidos: number; bloqueado_hasta: string | null }>();
    expect(fila!.intentos_fallidos).toBe(5);
    expect(fila!.bloqueado_hasta).not.toBeNull();

    const conClaveBuena = await entrar({ rut: RUT, password: CLAVE });
    expect(conClaveBuena.status).toBe(429);
  });

  it('entrar bien borra los intentos fallidos acumulados', async () => {
    const id = await usuario();
    await entrar({ rut: RUT, password: 'equivocada-1' });
    await entrar({ rut: RUT, password: CLAVE });
    const fila = await env.DB.prepare('SELECT intentos_fallidos FROM usuarios WHERE id = ?').bind(id).first<{ intentos_fallidos: number }>();
    expect(fila!.intentos_fallidos).toBe(0);
  });

  it('frena a la conexión que ya falló 20 veces, aunque pruebe con RUT distintos', async () => {
    await usuario();
    for (let i = 0; i < 20; i += 1) {
      await env.DB.prepare("INSERT INTO log_eventos (accion, ip) VALUES ('LOGIN_FAIL', '203.0.113.7')").run();
    }
    const res = await entrar({ rut: RUT, password: CLAVE }, { 'CF-Connecting-IP': '203.0.113.7' });
    expect(res.status).toBe(429);

    const otraIp = await entrar({ rut: RUT, password: CLAVE }, { 'CF-Connecting-IP': '203.0.113.8' });
    expect(otraIp.status).toBe(200);
  });

  it('anota cada fallo en la bitácora', async () => {
    await usuario();
    await entrar({ rut: RUT, password: 'equivocada-1' });
    await entrar({ rut: '12.345.670-K', password: CLAVE });
    expect(await contar('LOGIN_FAIL')).toBe(2);
  });

  it('pide los dos campos y corta los valores absurdos', async () => {
    expect((await entrar({ rut: RUT })).status).toBe(400);
    expect((await entrar({ password: CLAVE })).status).toBe(400);
    expect((await entrar({ rut: '1'.repeat(40), password: CLAVE })).status).toBe(400);
    expect((await entrar({ rut: RUT, password: 'x'.repeat(200) })).status).toBe(400);
  });

  it('si Turnstile dice que no, no se intenta siquiera', async () => {
    await usuario();
    anti.bot = { ok: false, mensaje: 'Verificación anti-bot fallida', status: 403 };
    const res = await entrar({ rut: RUT, password: CLAVE });
    expect(res.status).toBe(403);
    expect(await contar('LOGIN_OK')).toBe(0);
  });
});

describe('cambiar la contraseña', () => {
  const cambiar = (cookie: string | null, body: unknown) =>
    cambiarClave(
      pedir('/api/auth/cambiar-clave', cookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

  async function soloEntrar(clave = CLAVE) {
    const res = await entrar({ rut: RUT, password: clave });
    const token = res.headers.get('Set-Cookie')!.split(';')[0].split('=')[1];
    return `cota_sesion=${token}`;
  }

  async function conSesion() {
    await usuario({ claveTemporal: true });
    return soloEntrar();
  }

  it('la cambia, saca la marca de temporal y deja una sesión nueva', async () => {
    const cookie = await conSesion();
    const res = await cambiar(cookie, { actual: CLAVE, nueva: 'nueva-clave-2026' });

    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('cota_sesion=');

    const fila = await env.DB.prepare('SELECT password_temporal FROM usuarios').first<{ password_temporal: number }>();
    expect(fila!.password_temporal).toBe(0);
    expect((await entrar({ rut: RUT, password: 'nueva-clave-2026' })).status).toBe(200);
  });

  it('cierra las sesiones abiertas con la clave vieja', async () => {
    const vieja = await conSesion();
    const otra = await soloEntrar(); // segunda sesión de la misma cuenta

    await cambiar(otra, { actual: CLAVE, nueva: 'nueva-clave-2026' });

    // La sesión vieja ya no sirve para nada del panel.
    const res = await cambiar(vieja, { actual: 'nueva-clave-2026', nueva: 'otra-mas-2026' });
    expect(res.status).toBe(401);
  });

  it('rechaza la clave actual equivocada y deja rastro', async () => {
    const cookie = await conSesion();
    const res = await cambiar(cookie, { actual: 'no-es-la-mia-1', nueva: 'nueva-clave-2026' });
    expect(res.status).toBe(401);
    expect(await contar('CLAVE_CAMBIO_FALLIDO')).toBe(1);
  });

  it('exige que la nueva cumpla la política y sea distinta', async () => {
    const cookie = await conSesion();
    expect((await cambiar(cookie, { actual: CLAVE, nueva: 'corta1' })).status).toBe(422);
    expect((await cambiar(cookie, { actual: CLAVE, nueva: CLAVE })).status).toBe(422);
  });

  it('sin sesión no se puede', async () => {
    expect((await cambiar(null, { actual: CLAVE, nueva: 'nueva-clave-2026' })).status).toBe(401);
  });
});

describe('salir', () => {
  it('borra la sesión de la base y manda la cookie vencida', async () => {
    const { cookie } = await sesionDePrueba();
    const res = await logout(pedir('/api/auth/logout', cookie, { method: 'POST' }));

    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM sesiones').first<{ n: number }>()).toMatchObject({ n: 0 });
    expect(await contar('LOGOUT')).toBe(1);
  });

  it('sin cookie responde igual, sin reventar', async () => {
    expect((await logout(pedir('/api/auth/logout', null, { method: 'POST' }))).status).toBe(200);
  });
});
