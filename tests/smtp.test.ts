import { beforeEach, describe, expect, it, vi } from 'vitest';

const mundo = vi.hoisted(() => ({
  opciones: null as Record<string, unknown> | null,
  mensaje: null as Record<string, unknown> | null,
  resultado: { accepted: ['cliente@example.com'], messageId: '<prueba@example.com>', response: '250 OK' } as {
    accepted: string[];
    messageId?: string;
    response?: string;
    serverMessageId?: string;
  },
  fallo: null as Error | null,
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (opciones: Record<string, unknown>) => {
      mundo.opciones = opciones;
      return {
        sendMail: async (mensaje: Record<string, unknown>) => {
          mundo.mensaje = mensaje;
          if (mundo.fallo) throw mundo.fallo;
          return mundo.resultado;
        },
      };
    },
  },
}));

const { configuracionSmtp, enviarSmtp } = await import('@/lib/smtp');

beforeEach(() => {
  mundo.opciones = null;
  mundo.mensaje = null;
  mundo.resultado = { accepted: ['cliente@example.com'], messageId: '<prueba@example.com>', response: '250 OK' };
  mundo.fallo = null;
  process.env.SMTP_HOST = 'mail.example.com';
  process.env.SMTP_PORT = '465';
  process.env.SMTP_USER = 'contacto@example.com';
  process.env.SMTP_PASS = 'secreto-de-prueba';
  process.env.LEADS_FROM = 'Cota Clara <contacto@example.com>';
});

const mensaje = { to: 'cliente@example.com', subject: 'Respuesta', text: 'Hola', replyTo: 'contacto@example.com' };

describe('correo del hosting', () => {
  it('usa TLS seguro en 465 y confirma solo al destinatario aceptado', async () => {
    expect(configuracionSmtp().lista).toBe(true);
    expect(await enviarSmtp(mensaje)).toEqual({ estado: 'enviado', id: '<prueba@example.com>' });
    expect(mundo.opciones).toMatchObject({ host: 'mail.example.com', port: 465, secure: true, auth: { user: 'contacto@example.com' } });
    expect(mundo.mensaje).toMatchObject({ to: ['cliente@example.com'], replyTo: 'contacto@example.com' });
  });

  it('requiere STARTTLS en 587 y no intenta salir con configuración incompleta', async () => {
    process.env.SMTP_PORT = '587';
    expect((await enviarSmtp(mensaje)).estado).toBe('enviado');
    expect(mundo.opciones).toMatchObject({ port: 587, secure: false, requireTLS: true });
    mundo.opciones = null;
    delete process.env.SMTP_PASS;
    expect(configuracionSmtp().lista).toBe(false);
    expect(await enviarSmtp(mensaje)).toEqual({ estado: 'sin-configurar' });
    expect(mundo.opciones).toBeNull();
  });

  it('separa rechazo previo del resultado incierto después de comenzar el envío', async () => {
    mundo.fallo = Object.assign(new Error('Autenticación rechazada'), { code: 'EAUTH', command: 'AUTH PLAIN' });
    expect((await enviarSmtp(mensaje)).estado).toBe('error');
    mundo.fallo = Object.assign(new Error('Se perdió la conexión'), { code: 'ESOCKET', command: 'DATA' });
    expect((await enviarSmtp(mensaje)).estado).toBe('incierto');
  });

  it('no marca como enviado un correo con destinatarios parcialmente rechazados', async () => {
    mundo.resultado = { accepted: ['cliente@example.com'], messageId: '<prueba@example.com>' };
    expect((await enviarSmtp({ ...mensaje, to: ['cliente@example.com', 'otro@example.com'] })).estado).toBe('incierto');
  });
});
