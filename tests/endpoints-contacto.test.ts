import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pedir, sesionDePrueba } from './sesion';

// Dos perillas para simular lo que puede salir mal: que la base no responda y
// lo que conteste el servicio de correo. Resend sale a internet, así que acá
// se reemplaza por su resultado; lo que se prueba es qué hace la ruta con él.
const mundo = vi.hoisted(() => ({
  baseCaida: false,
  correo: { estado: 'sin-configurar' } as
    | { estado: 'enviado'; id: string }
    | { estado: 'sin-configurar' }
    | { estado: 'error'; detalle: string },
}));

vi.mock('@/lib/db', () => ({
  obtenerDB: async () => {
    if (mundo.baseCaida) throw new Error('la base no responde');
    return env.DB;
  },
  obtenerFotos: async () => env.FOTOS,
}));

vi.mock('@/lib/leads', async (original) => ({
  ...(await original<typeof import('@/lib/leads')>()),
  enviarLead: async () => mundo.correo,
}));

const { POST: contacto } = await import('../src/app/api/contacto/route');
const { DELETE: borrarSolicitud } = await import('../src/app/api/panel/solicitudes/[id]/route');
const { MAX_POR_IP, solicitudesRecientes } = await import('@/lib/solicitudes');

const ruta = (id: string | number) => ({ params: Promise.resolve({ id: String(id) }) });

const formulario = (extra: Record<string, unknown> = {}) => ({
  variante: 'tasacion',
  nombre: 'Camila Rojas',
  email: 'camila@example.com',
  telefono: '+56 9 1234 5678',
  tipo: 'Departamento',
  comuna: 'Providencia',
  mensaje: 'Quiero tasar mi departamento.',
  acepto: 'si',
  ...extra,
});

const enviar = (body: unknown, ip: string | null = '203.0.113.10') =>
  contacto(
    pedir('/api/contacto', null, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(ip ? { 'CF-Connecting-IP': ip } : {}) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

const filas = async () =>
  (await env.DB.prepare('SELECT * FROM solicitudes ORDER BY id').all<Record<string, string | number | null>>()).results;

beforeEach(() => {
  mundo.baseCaida = false;
  mundo.correo = { estado: 'sin-configurar' };
});

describe('una solicitud no se pierde', () => {
  it('queda guardada y la persona recibe ok aunque no haya correo configurado', async () => {
    const res = await enviar(formulario());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const [fila] = await filas();
    expect(fila).toMatchObject({
      variante: 'tasacion',
      nombre: 'Camila Rojas',
      email: 'camila@example.com',
      telefono: '+56 9 1234 5678',
      comuna: 'Providencia',
      mensaje: 'Quiero tasar mi departamento.',
      correo: 'sin-configurar',
    });
  });

  it('anota que el aviso por correo salió', async () => {
    mundo.correo = { estado: 'enviado', id: 'abc' };
    expect((await enviar(formulario())).status).toBe(200);
    expect((await filas())[0].correo).toBe('enviado');
  });

  it('si el correo falla, igual queda guardada y la persona recibe ok', async () => {
    mundo.correo = { estado: 'error', detalle: 'el servicio no respondió' };
    expect((await enviar(formulario())).status).toBe(200);
    expect((await filas())[0].correo).toBe('error');
  });

  it('si la base no responde pero el correo sale, también llegó', async () => {
    mundo.baseCaida = true;
    mundo.correo = { estado: 'enviado', id: 'abc' };
    expect((await enviar(formulario())).status).toBe(200);
  });

  it('solo le dice a la persona que no llegó cuando no quedó en ninguna parte', async () => {
    mundo.baseCaida = true;

    mundo.correo = { estado: 'sin-configurar' };
    expect((await enviar(formulario())).status).toBe(503);

    mundo.correo = { estado: 'error', detalle: 'el servicio no respondió' };
    expect((await enviar(formulario())).status).toBe(502);
  });
});

describe('lo que no se guarda', () => {
  it('descarta en silencio a quien llena el campo trampa', async () => {
    const res = await enviar(formulario({ empresa: 'Bot S.A.' }));
    expect(res.status).toBe(200);
    expect(await filas()).toHaveLength(0);
  });

  it('rechaza el formulario sin nombre, sin correo válido o sin el consentimiento', async () => {
    expect((await enviar(formulario({ nombre: 'C' }))).status).toBe(422);
    expect((await enviar(formulario({ email: 'no-es-un-correo' }))).status).toBe(422);
    expect((await enviar(formulario({ acepto: '' }))).status).toBe(422);
    expect(await filas()).toHaveLength(0);
  });

  it('responde 400 si el cuerpo no es JSON', async () => {
    expect((await enviar('esto no es json')).status).toBe(400);
  });
});

describe('lo que guarda', () => {
  it('una variante que no conoce queda como consulta', async () => {
    await enviar(formulario({ variante: 'inventada' }));
    expect((await filas())[0].variante).toBe('contacto');
  });

  it('corta los textos al largo que acepta el formulario', async () => {
    await enviar(formulario({ mensaje: 'a'.repeat(5000), nombre: 'b'.repeat(300) }));
    const [fila] = await filas();
    expect(String(fila.mensaje)).toHaveLength(2000);
    expect(String(fila.nombre)).toHaveLength(120);
  });

  it('guarda la conexión para el tope, pero no la entrega al panel', async () => {
    await enviar(formulario(), '203.0.113.77');
    expect((await filas())[0].ip).toBe('203.0.113.77');

    const [solicitud] = await solicitudesRecientes();
    expect(solicitud).not.toHaveProperty('ip');
    expect(solicitud.nombre).toBe('Camila Rojas');
  });
});

describe('tope contra el abuso', () => {
  it('frena a la conexión que manda muchas seguidas, sin afectar a las demás', async () => {
    for (let i = 0; i < MAX_POR_IP; i += 1) {
      expect((await enviar(formulario(), '203.0.113.50')).status).toBe(200);
    }

    const frenada = await enviar(formulario(), '203.0.113.50');
    expect(frenada.status).toBe(429);
    expect(await filas()).toHaveLength(MAX_POR_IP);

    expect((await enviar(formulario(), '203.0.113.51')).status).toBe(200);
  });

  it('las solicitudes viejas no cuentan para el tope', async () => {
    for (let i = 0; i < MAX_POR_IP; i += 1) {
      await env.DB.prepare(
        "INSERT INTO solicitudes (nombre, email, ip, creada_en) VALUES ('Antigua', 'a@example.com', '203.0.113.60', datetime('now', '-1 hour'))",
      ).run();
    }
    expect((await enviar(formulario(), '203.0.113.60')).status).toBe(200);
  });
});

describe('solicitudes en el panel', () => {
  const borrar = (id: string | number, cookie: string | null) =>
    borrarSolicitud(pedir(`/api/panel/solicitudes/${id}`, cookie, { method: 'DELETE' }), ruta(id));

  it('salen de la más nueva a la más vieja', async () => {
    await env.DB.prepare(
      "INSERT INTO solicitudes (nombre, email, creada_en) VALUES ('Primera', 'a@example.com', datetime('now', '-2 days')), ('Última', 'b@example.com', datetime('now')), ('Del medio', 'c@example.com', datetime('now', '-1 day'))",
    ).run();
    expect((await solicitudesRecientes()).map((s) => s.nombre)).toEqual(['Última', 'Del medio', 'Primera']);
  });

  it('sin sesión no se puede borrar', async () => {
    await enviar(formulario());
    const [fila] = await filas();
    expect((await borrar(Number(fila.id), null)).status).toBe(401);
    expect(await filas()).toHaveLength(1);
  });

  it('borrarla elimina los datos de la persona, y en la bitácora queda solo quién y cuál', async () => {
    await enviar(formulario());
    const [fila] = await filas();
    const { cookie, usuarioId } = await sesionDePrueba({ rol: 'EDITOR' });

    expect((await borrar(Number(fila.id), cookie)).status).toBe(200);
    expect(await filas()).toHaveLength(0);

    const evento = await env.DB.prepare("SELECT usuario_id, detalle FROM log_eventos WHERE accion = 'SOLICITUD_ELIMINADA'").first<{
      usuario_id: number;
      detalle: string;
    }>();
    expect(evento!.usuario_id).toBe(usuarioId);
    expect(evento!.detalle).not.toContain('camila');
    expect(evento!.detalle).not.toContain('Camila');
  });

  it('404 si no existe y 400 si el id no sirve', async () => {
    const { cookie } = await sesionDePrueba();
    expect((await borrar(9999, cookie)).status).toBe(404);
    expect((await borrar('abc', cookie)).status).toBe(400);
  });
});

describe('retención de la conexión', () => {
  it('cada solicitud nueva borra la ip de las de hace más de un día, y conserva su contenido', async () => {
    await env.DB.prepare(
      "INSERT INTO solicitudes (nombre, email, ip, creada_en) VALUES ('Antigua', 'a@example.com', '203.0.113.90', datetime('now', '-2 days')), ('Reciente', 'r@example.com', '203.0.113.91', datetime('now', '-1 hour'))",
    ).run();

    await enviar(formulario(), '203.0.113.92');

    const ips = Object.fromEntries((await filas()).map((f) => [f.nombre, f.ip]));
    expect(ips['Antigua']).toBeNull();
    expect(ips['Reciente']).toBe('203.0.113.91');
    expect(ips['Camila Rojas']).toBe('203.0.113.92');
    expect(await filas()).toHaveLength(3);
  });
});
