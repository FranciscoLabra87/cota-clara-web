import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Resend sale a internet, así que acá se reemplaza fetch por lo que contestaría.
// Lo que se prueba es qué se le pide y qué hace el módulo con la respuesta.
const mundo = vi.hoisted(() => ({ smtp: [] as unknown[] }));

vi.mock('@/lib/smtp', () => ({
  configuracionSmtp: () =>
    process.env.SMTP_HOST ? { lista: true } : { lista: false, detalle: 'Faltan variables SMTP: SMTP_HOST' },
  enviarSmtp: async (mensaje: unknown) => {
    mundo.smtp.push(mensaje);
    return { estado: 'enviado', id: 'smtp-1' };
  },
}));

const { configuracionCorreo, enviarCorreo } = await import('@/lib/correo');

const mensaje = {
  to: 'cliente@example.com',
  subject: 'Asunto',
  text: 'Texto',
  html: '<p>Texto</p>',
  replyTo: 'contacto@cotaclara.cl',
  headers: { 'Auto-Submitted': 'auto-generated' },
};

const responder = (status: number, cuerpo: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(cuerpo), { status }));

beforeEach(() => {
  mundo.smtp = [];
  process.env.RESEND_API_KEY = 're_prueba';
  process.env.LEADS_FROM = 'Cota Clara <info@cotaclara.cl>';
  delete process.env.SMTP_HOST;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.RESEND_API_KEY;
  delete process.env.LEADS_FROM;
  delete process.env.SMTP_HOST;
});

describe('por dónde sale', () => {
  it('con clave de Resend sale por Resend, aunque también haya SMTP', async () => {
    process.env.SMTP_HOST = 'host12.example.com';
    responder(200, { id: 'resend-1' });
    expect(configuracionCorreo()).toEqual({ lista: true, via: 'resend' });
    expect(await enviarCorreo(mensaje)).toEqual({ estado: 'enviado', id: 'resend-1' });
    expect(mundo.smtp).toHaveLength(0);
  });

  it('sin clave cae al SMTP del hosting', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.SMTP_HOST = 'host12.example.com';
    expect(configuracionCorreo()).toEqual({ lista: true, via: 'smtp' });
    expect(await enviarCorreo(mensaje)).toEqual({ estado: 'enviado', id: 'smtp-1' });
  });

  it('sin ninguno de los dos no está listo', () => {
    delete process.env.RESEND_API_KEY;
    expect(configuracionCorreo().lista).toBe(false);
  });
});

describe('Resend', () => {
  it('manda remitente, destinatarios, Reply-To y cabeceras con la clave', async () => {
    const fetch = responder(200, { id: 'resend-1' });
    await enviarCorreo({ ...mensaje, messageId: '<solicitud-1@cotaclara.cl>' });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer re_prueba');
    expect(JSON.parse(String(init.body))).toEqual({
      from: 'Cota Clara <info@cotaclara.cl>',
      to: ['cliente@example.com'],
      subject: 'Asunto',
      text: 'Texto',
      html: '<p>Texto</p>',
      reply_to: 'contacto@cotaclara.cl',
      headers: { 'Auto-Submitted': 'auto-generated', 'X-Cota-Ref': '<solicitud-1@cotaclara.cl>' },
    });
  });

  it('un rechazo 4xx es error, con el motivo de Resend', async () => {
    responder(403, { name: 'validation_error', message: 'The domain is not verified' });
    expect(await enviarCorreo(mensaje)).toEqual({
      estado: 'error',
      detalle: 'Resend 403 validation_error: The domain is not verified',
    });
  });

  it('un 5xx o un corte de red queda incierto, para no duplicar', async () => {
    responder(500, {});
    expect((await enviarCorreo(mensaje)).estado).toBe('incierto');

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('sin red'));
    expect(await enviarCorreo(mensaje)).toEqual({ estado: 'incierto', detalle: 'sin red' });
  });
});
