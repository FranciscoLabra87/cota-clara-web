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
  avisos: [] as Array<{ lead: Record<string, string>; ficha: Record<string, string> | null | undefined }>,
  fichasConfirmadas: [] as Array<Record<string, string> | null | undefined>,
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
  enviarLead: async (lead: Record<string, string>, ficha?: Record<string, string> | null) => {
    mundo.avisos.push({ lead, ficha });
    return mundo.correo;
  },
  enviarConfirmacion: async (lead: { email: string }, ficha?: Record<string, string> | null) => {
    mundo.confirmaciones.push(lead.email);
    mundo.fichasConfirmadas.push(ficha);
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
const { ASUNTO_CONFIRMACION, asuntoLead, htmlConfirmacion, htmlLead, saludo, textoConfirmacion, textoLead } = await import('@/lib/leads');

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

const enviar = (body: unknown, ip: string | null = '203.0.113.10', headers: Record<string, string> = {}) =>
  contacto(
    pedir('/api/contacto', null, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(ip ? { 'CF-Connecting-IP': ip } : {}), ...headers },
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
  mundo.avisos = [];
  mundo.fichasConfirmadas = [];
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

  it('rechaza JSON que no es un objeto sin guardar ni mandar correos', async () => {
    for (const body of [null, [], [formulario()], 42, true, '"texto"']) {
      expect((await enviar(body)).status).toBe(400);
    }
    expect(await filas()).toHaveLength(0);
    expect(mundo.avisos).toHaveLength(0);
    expect(mundo.confirmaciones).toHaveLength(0);
  });

  it('exige el consentimiento explícito del checkbox, no un valor truthy', async () => {
    for (const acepto of ['no', 'false', '0', true, 1, ['si']]) {
      const res = await enviar(formulario({ acepto }));
      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({ errores: { acepto: expect.any(String) } });
    }
    expect(await filas()).toHaveLength(0);
    expect(mundo.avisos).toHaveLength(0);
  });

  it('valida en el servidor los selectores de tasación y el teléfono opcional', async () => {
    for (const dato of [{ tipo: '' }, { tipo: 'inventado' }, { comuna: '' }, { comuna: 'inventada' }, { telefono: 'abc12345678' }, { motivo: 'inventado' }]) {
      expect((await enviar(formulario(dato))).status).toBe(422);
    }
    expect(await filas()).toHaveLength(0);
    expect((await enviar(formulario({ telefono: '', comuna: 'Otra' }))).status).toBe(200);
  });

  it('no acepta tipos JSON distintos de los campos de texto', async () => {
    for (const dato of [{ nombre: [] }, { email: { value: 'camila@example.com' } }, { telefono: 912345678 }, { tipo: ['departamento'] }]) {
      expect((await enviar(formulario(dato))).status).toBe(422);
    }
    expect(await filas()).toHaveLength(0);
  });

  it('un origen ajeno no puede provocar registros ni avisos', async () => {
    for (const Origin of ['https://otro.example', 'null', 'http://localhost.otro.example']) {
      expect((await enviar(formulario(), null, { Origin })).status).toBe(403);
    }
    expect(await filas()).toHaveLength(0);
    expect(mundo.avisos).toHaveLength(0);
    expect((await enviar(formulario(), null, { Origin: 'http://localhost' })).status).toBe(200);
  });

  it('rechaza cuerpos excesivos aunque no anuncien su tamaño o mientan', async () => {
    const excesivo = formulario({ mensaje: 'a'.repeat(40_000) });
    expect((await enviar(excesivo)).status).toBe(413);
    expect((await enviar(excesivo, null, { 'Content-Length': '10' })).status).toBe(413);
    expect((await enviar(formulario(), null, { 'Content-Length': '40000' })).status).toBe(413);
    expect((await enviar(formulario({ mensaje: 'ñ'.repeat(20_000) }))).status).toBe(413);
    expect(await filas()).toHaveLength(0);
    expect(mundo.avisos).toHaveLength(0);
  });
});

describe('lo que guarda', () => {
  it('una variante que no conoce queda como consulta', async () => {
    await enviar(formulario({ variante: 'inventada' }));
    expect((await filas())[0].variante).toBe('contacto');
  });

  it('conserva el texto completo hasta el límite y rechaza lo que lo excede sin recortarlo', async () => {
    expect((await enviar(formulario({ mensaje: 'a'.repeat(2000), nombre: 'b'.repeat(120) }))).status).toBe(200);
    const res = await enviar(formulario({ mensaje: 'a'.repeat(2001), nombre: 'b'.repeat(121) }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ errores: { mensaje: expect.any(String), nombre: expect.any(String) } });
    const guardadas = await filas();
    expect(guardadas).toHaveLength(1);
    expect(String(guardadas[0].mensaje)).toHaveLength(2000);
    expect(String(guardadas[0].nombre)).toHaveLength(120);
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

describe('formulario de la ficha de una propiedad', () => {
  const publicar = async (slug: string, estado = 'PUBLICADA') =>
    (await env.DB.prepare(
      `INSERT INTO propiedades (slug, titulo, tipo, operacion, comuna, precio_valor, precio_moneda, publicada, estado)
       VALUES (?, 'Casa con vista', 'casa', 'venta', 'Quilpué', 5000, 'UF', '2026-11-17', ?) RETURNING id`,
    )
      .bind(slug, estado)
      .first<{ id: number }>())!.id;

  const desdeLaFicha = (extra: Record<string, unknown> = {}) =>
    formulario({ variante: 'visita', propiedad: 'casa-quilpue', motivo: 'Agendar una reunión', mensaje: '', ...extra });

  it('el aviso y la confirmación llevan la propiedad leída de la base, con sus enlaces', async () => {
    const id = await publicar('casa-quilpue');
    expect((await enviar(desdeLaFicha())).status).toBe(200);

    const ficha = mundo.avisos[0].ficha;
    expect(ficha).toMatchObject({
      titulo: 'Casa con vista',
      url: 'https://www.cotaclara.cl/propiedades/casa-quilpue',
      panel: `https://www.cotaclara.cl/panel/propiedades/${id}/seguimiento`,
    });
    expect(ficha?.precio).toContain('UF');
    expect(mundo.fichasConfirmadas[0]).toEqual(ficha);
    expect((await filas())[0].motivo).toBe('Agendar una reunión');
  });

  it('rechaza motivos que no son de la ficha y mantiene pedir información sin fecha', async () => {
    await publicar('casa-quilpue');
    expect((await enviar(desdeLaFicha({ motivo: 'Comprar ya <b>' }))).status).toBe(422);
    expect(await filas()).toHaveLength(0);
    expect((await enviar(desdeLaFicha({ motivo: 'Pedir información', fecha: '' }))).status).toBe(200);
    expect((await filas())[0].motivo).toBe('Pedir información');
  });

  it('la fecha sigue siendo opcional, pero si viene debe existir en el calendario', async () => {
    expect((await enviar(desdeLaFicha({ fecha: '2026-02-29' }))).status).toBe(422);
    expect((await enviar(desdeLaFicha({ fecha: '2026-04-31' }))).status).toBe(422);
    expect((await enviar(desdeLaFicha({ fecha: 'mañana' }))).status).toBe(422);
    expect(await filas()).toHaveLength(0);
    expect((await enviar(desdeLaFicha({ fecha: '2028-02-29' }))).status).toBe(200);
    expect((await filas())[0].fecha).toBe('2028-02-29');
  });

  it('una propiedad en borrador o que no existe no entra al aviso, pero el lead llega igual', async () => {
    await publicar('casa-quilpue', 'BORRADOR');
    expect((await enviar(desdeLaFicha())).status).toBe(200);
    expect((await enviar(desdeLaFicha({ propiedad: 'no-existe' }), '203.0.113.11')).status).toBe(200);
    expect(mundo.avisos.map((a) => a.ficha)).toEqual([null, null]);
    expect(await filas()).toHaveLength(2);
  });

  it('el aviso dice qué se pidió y por cuál propiedad', () => {
    const ficha = { titulo: 'Casa con vista', precio: '5.000 UF · Venta', url: 'https://www.cotaclara.cl/propiedades/casa-quilpue', panel: 'https://www.cotaclara.cl/panel/propiedades/1/seguimiento' };
    const lead = { variante: 'visita', nombre: 'Camila Rojas', email: 'camila@example.com', telefono: '', tipo: '', comuna: '', motivo: 'Agendar una reunión', fecha: '', mensaje: 'Hola', propiedad: 'casa-quilpue' };

    expect(asuntoLead(lead, ficha)).toBe('Solicitud de reunión · Camila Rojas · Casa con vista');
    expect(asuntoLead({ ...lead, motivo: 'Pedir información' }, ficha)).toBe('Consulta por propiedad · Camila Rojas · Casa con vista');
    for (const cuerpo of [textoLead(lead, ficha), htmlLead(lead, ficha)]) {
      expect(cuerpo).toContain('Casa con vista · 5.000 UF · Venta');
      expect(cuerpo).toContain(ficha.url);
      expect(cuerpo).toContain(ficha.panel);
    }
    for (const cuerpo of [textoConfirmacion(lead, ficha), htmlConfirmacion(lead, ficha)]) {
      expect(cuerpo).toContain('reunión por «Casa con vista»');
      expect(cuerpo).toContain(ficha.url);
      expect(cuerpo).not.toContain(ficha.panel);
    }
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
