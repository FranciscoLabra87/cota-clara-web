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
  respuesta: { estado: 'enviado', id: 'respuesta-prueba' } as
    | { estado: 'enviado'; id: string }
    | { estado: 'sin-configurar' }
    | { estado: 'error'; detalle: string }
    | { estado: 'incierto'; detalle: string },
  enviosRespuesta: [] as Array<{ id: number; email: string; respuesta: string; clave: string }>,
  confirmacion: { estado: 'enviado', id: 'confirmacion-prueba' } as
    | { estado: 'enviado'; id: string }
    | { estado: 'sin-configurar' }
    | { estado: 'error'; detalle: string },
  confirmaciones: [] as string[],
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
  enviarConfirmacion: async (lead: { email: string }) => {
    mundo.confirmaciones.push(lead.email);
    return mundo.confirmacion;
  },
}));

vi.mock('@/lib/respuesta-email', () => ({
  enviarRespuesta: async (datos: { id: number; email: string; respuesta: string; clave: string }) => {
    mundo.enviosRespuesta.push(datos);
    return mundo.respuesta;
  },
}));

const { POST: contacto } = await import('../src/app/api/contacto/route');
const { POST: responderSolicitud, PATCH: reintentarSolicitud, DELETE: borrarSolicitud } = await import('../src/app/api/panel/solicitudes/[id]/route');
const { MAX_CONFIRMACIONES_POR_CORREO, MAX_POR_IP, solicitudesRecientes, solicitudesSinResponder } = await import('@/lib/solicitudes');
const { ASUNTO_CONFIRMACION, htmlConfirmacion, saludo, textoConfirmacion } = await import('@/lib/leads');

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
  mundo.respuesta = { estado: 'enviado', id: 'respuesta-prueba' };
  mundo.enviosRespuesta = [];
  mundo.confirmacion = { estado: 'enviado', id: 'confirmacion-prueba' };
  mundo.confirmaciones = [];
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.LEADS_FROM;
  delete process.env.RESEND_API_KEY;
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

  it('exige que la consulta de contacto explique el requerimiento', async () => {
    expect((await enviar(formulario({ variante: 'contacto', mensaje: 'Breve' }))).status).toBe(422);
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

describe('respuesta desde el panel', () => {
  const responder = (id: string | number, cookie: string | null, body: Record<string, unknown>) =>
    responderSolicitud(pedir(`/api/panel/solicitudes/${id}`, cookie, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }), ruta(id));
  const reintentar = (id: string | number, cookie: string | null) =>
    reintentarSolicitud(pedir(`/api/panel/solicitudes/${id}`, cookie, { method: 'PATCH' }), ruta(id));
  const activarCorreo = () => {
    process.env.SMTP_HOST = 'mail.example.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'contacto@example.com';
    process.env.SMTP_PASS = 'clave-de-prueba';
    process.env.LEADS_FROM = 'Cota Clara <contacto@cotaclara.cl>';
  };

  it('exige sesión y configuración de salida antes de tomar el ticket', async () => {
    await enviar(formulario({ variante: 'contacto', mensaje: 'Necesito asesoría para vender.' }));
    const [fila] = await filas();
    const { cookie } = await sesionDePrueba({ rol: 'EDITOR' });
    expect((await responder(Number(fila.id), null, { respuesta: 'Gracias por escribirnos.', nota: 'Se revisará venta.' })).status).toBe(401);
    expect((await responder(Number(fila.id), cookie, { respuesta: 'Gracias por escribirnos.', nota: 'Se revisará venta.' })).status).toBe(503);
    expect((await filas())[0].estado).toBe('pendiente');
    expect(mundo.enviosRespuesta).toHaveLength(0);
  });

  it('valida respuesta y nota, envía al correo de la solicitud y guarda responsable y fecha una sola vez', async () => {
    activarCorreo();
    await enviar(formulario({ variante: 'contacto', mensaje: 'Quiero conocer sus servicios.' }));
    const [fila] = await filas();
    const id = Number(fila.id);
    const { cookie, usuarioId } = await sesionDePrueba({ rol: 'EDITOR' });
    expect((await responder(id, cookie, { respuesta: 'Corta', nota: 'Ok' })).status).toBe(422);
    const respuesta = 'Gracias por escribirnos. Podemos agendar una reunión esta semana.';
    expect((await responder(id, cookie, { respuesta, nota: 'Consulta general; propuse reunión.', email: 'intruso@example.com' })).status).toBe(200);
    const guardada = (await filas())[0];
    expect(guardada).toMatchObject({
      estado: 'respondida',
      respuesta_texto: respuesta,
      nota_respuesta: 'Consulta general; propuse reunión.',
      respuesta_email_id: 'respuesta-prueba',
      respondida_por: usuarioId,
    });
    expect(guardada.respondida_en).toBeTruthy();
    expect(mundo.enviosRespuesta).toHaveLength(1);
    expect(mundo.enviosRespuesta[0].email).toBe('camila@example.com');
    expect((await responder(id, cookie, { respuesta, nota: 'Otra nota' })).status).toBe(409);
    expect(mundo.enviosRespuesta).toHaveLength(1);
  });

  it('conserva el texto y la clave para reintentar un envío rechazado', async () => {
    activarCorreo();
    await enviar(formulario());
    const id = Number((await filas())[0].id);
    const { cookie } = await sesionDePrueba();
    mundo.respuesta = { estado: 'error', detalle: 'SMTP rechazó el envío' };
    expect((await responder(id, cookie, { respuesta: 'Tu tasación está en revisión.', nota: 'Falta coordinar visita.' })).status).toBe(502);
    expect((await filas())[0].estado).toBe('error');
    const primer = mundo.enviosRespuesta[0];
    mundo.respuesta = { estado: 'enviado', id: 'reintento-prueba' };
    expect((await reintentar(id, cookie)).status).toBe(200);
    expect((await filas())[0]).toMatchObject({ estado: 'respondida', respuesta_email_id: 'reintento-prueba' });
    expect(mundo.enviosRespuesta[1].clave).toBe(primer.clave);
    expect(mundo.enviosRespuesta[1].respuesta).toBe(primer.respuesta);
  });

  it('si el resultado es incierto bloquea el reintento inmediato y el borrado', async () => {
    activarCorreo();
    await enviar(formulario());
    const id = Number((await filas())[0].id);
    const { cookie } = await sesionDePrueba();
    mundo.respuesta = { estado: 'incierto', detalle: 'se cortó la red' };
    expect((await responder(id, cookie, { respuesta: 'Revisaremos tu tasación y te contactaremos.', nota: 'Pendiente de confirmación.' })).status).toBe(503);
    expect((await filas())[0].estado).toBe('enviando');
    expect((await reintentar(id, cookie)).status).toBe(409);
    expect((await borrarSolicitud(pedir(`/api/panel/solicitudes/${id}`, cookie, { method: 'DELETE' }), ruta(id))).status).toBe(409);
  });
});

describe('confirmación a quien llenó el formulario', () => {
  const lead = {
    variante: 'tasacion',
    nombre: 'Camila Rojas',
    email: 'camila@example.com',
    telefono: '',
    tipo: '',
    comuna: 'Providencia',
    motivo: '',
    fecha: '',
    mensaje: 'Compra barato en spam.example',
    propiedad: '',
  };

  it('se le manda al correo del formulario cuando la solicitud queda guardada', async () => {
    expect((await enviar(formulario())).status).toBe(200);
    expect(mundo.confirmaciones).toEqual(['camila@example.com']);
  });

  it('si la solicitud no se guardó, no se confirma nada', async () => {
    mundo.baseCaida = true;
    mundo.correo = { estado: 'enviado', id: 'abc' };
    expect((await enviar(formulario())).status).toBe(200);
    expect(mundo.confirmaciones).toEqual([]);
  });

  it('si la confirmación falla, la persona igual recibe ok', async () => {
    mundo.confirmacion = { estado: 'error', detalle: 'el servidor no respondió' };
    expect((await enviar(formulario())).status).toBe(200);
    expect(await filas()).toHaveLength(1);
  });

  it('deja de mandarle a una misma casilla pasado el tope del día, pero guarda la solicitud', async () => {
    for (let i = 0; i < MAX_CONFIRMACIONES_POR_CORREO + 2; i += 1) {
      expect((await enviar(formulario({ email: i % 2 ? 'CAMILA@example.com' : 'camila@example.com' }), `203.0.113.${100 + i}`)).status).toBe(200);
    }
    expect(mundo.confirmaciones).toHaveLength(MAX_CONFIRMACIONES_POR_CORREO);
    expect(await filas()).toHaveLength(MAX_CONFIRMACIONES_POR_CORREO + 2);
  });

  it('no repite lo que se escribió en el formulario, salvo un primer nombre de solo letras', () => {
    const texto = textoConfirmacion(lead);
    const html = htmlConfirmacion(lead);
    for (const cuerpo of [texto, html]) {
      expect(cuerpo).not.toContain('spam.example');
      expect(cuerpo).not.toContain('Providencia');
      expect(cuerpo).not.toContain('Rojas');
      expect(cuerpo).toContain('Camila');
      expect(cuerpo).toContain('tasación');
      expect(cuerpo).toContain('contacto@cotaclara.cl');
      expect(cuerpo).toContain('no lo respondas');
    }
    expect(ASUNTO_CONFIRMACION).toContain('ingresada con éxito');
  });

  it('un nombre que no es solo letras no entra al saludo', () => {
    expect(saludo('José-Tomás Pérez')).toBe('Hola, José-Tomás:');
    expect(saludo('visita http://spam.example')).toBe('Hola, visita:');
    expect(saludo('http://spam.example')).toBe('Hola:');
    expect(saludo('<b>Ana</b>')).toBe('Hola:');
  });
});

describe('contador del panel', () => {
  it('cuenta las nuevas y las de respuesta fallida, no las respondidas ni las en envío', async () => {
    await env.DB.prepare(
      "INSERT INTO solicitudes (nombre, email, estado) VALUES ('A', 'a@example.com', 'pendiente'), ('B', 'b@example.com', 'pendiente'), ('C', 'c@example.com', 'error'), ('D', 'd@example.com', 'respondida'), ('E', 'e@example.com', 'enviando')",
    ).run();
    expect(await solicitudesSinResponder()).toBe(3);
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
