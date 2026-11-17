import nodemailer from 'nodemailer';

export type ResultadoSmtp =
  | { estado: 'enviado'; id: string }
  | { estado: 'sin-configurar' }
  | { estado: 'error'; detalle: string }
  | { estado: 'incierto'; detalle: string };

type MensajeSmtp = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  messageId?: string;
};

type Configuracion = {
  host: string;
  port: 465 | 587;
  user: string;
  pass: string;
  from: string;
};

function leerConfiguracion(): { datos: Configuracion; detalle?: never } | { datos?: never; detalle: string } {
  const host = process.env.SMTP_HOST?.trim();
  const puerto = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = process.env.LEADS_FROM?.trim();
  const faltan = [
    !host && 'SMTP_HOST',
    !puerto && 'SMTP_PORT',
    !user && 'SMTP_USER',
    !pass && 'SMTP_PASS',
    !from && 'LEADS_FROM',
  ].filter(Boolean);

  if (faltan.length) return { detalle: `Faltan variables SMTP: ${faltan.join(', ')}` };
  if (puerto !== '465' && puerto !== '587') return { detalle: 'SMTP_PORT debe ser 465 o 587' };
  if (!host || !user || !pass || !from) return { detalle: 'Configuración SMTP incompleta' };
  return { datos: { host, port: Number(puerto) as 465 | 587, user, pass, from } };
}

/** Indica si el servidor y las credenciales están definidos; no prueba conectividad. */
export function configuracionSmtp(): { lista: true } | { lista: false; detalle: string } {
  const configuracion = leerConfiguracion();
  return configuracion.datos ? { lista: true } : { lista: false, detalle: configuracion.detalle };
}

type ErrorSmtp = Error & { code?: string; command?: string };

/** Solo estos fallos prueban que SMTP no aceptó el mensaje. */
function falloDefinitivo(error: ErrorSmtp): boolean {
  if (['EAUTH', 'EENVELOPE', 'EMAXRECIPIENTS', 'ECONFIG', 'EDNS'].includes(error.code ?? '')) return true;
  const comando = error.command?.toUpperCase() ?? '';
  return /^(CONN|EHLO|HELO|STARTTLS|AUTH|MAIL FROM|RCPT TO)(\s|$)/.test(comando);
}

/**
 * Envía mediante el SMTP autenticado del hosting. Cada petición abre su propia
 * conexión: los sockets de Workers no se comparten entre solicitudes.
 */
export async function enviarSmtp(mensaje: MensajeSmtp): Promise<ResultadoSmtp> {
  const configuracion = leerConfiguracion();
  if (!configuracion.datos) return { estado: 'sin-configurar' };
  const { host, port, user, pass, from } = configuracion.datos;
  const destinatarios = Array.isArray(mensaje.to) ? mensaje.to : [mensaje.to];

  try {
    const transporte = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: { user, pass },
      pool: false,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    const info = await transporte.sendMail({
      from,
      to: destinatarios,
      subject: mensaje.subject,
      text: mensaje.text,
      html: mensaje.html,
      replyTo: mensaje.replyTo,
      messageId: mensaje.messageId,
    });

    const aceptados = new Set(info.accepted.map((direccion) => direccion.toLowerCase()));
    if (!destinatarios.every((direccion) => aceptados.has(direccion.toLowerCase()))) {
      // Puede haber entrega parcial. Repetir a toda la lista duplicaría correos.
      return { estado: 'incierto', detalle: 'El servidor aceptó solo parte de los destinatarios.' };
    }

    const id = info.serverMessageId || info.messageId || info.response;
    if (!id) return { estado: 'incierto', detalle: 'El servidor aceptó el mensaje sin identificador de seguimiento.' };
    return { estado: 'enviado', id };
  } catch (error) {
    const fallo = error instanceof Error ? error as ErrorSmtp : new Error('Fallo SMTP desconocido');
    return {
      estado: falloDefinitivo(fallo) ? 'error' : 'incierto',
      detalle: fallo.message,
    };
  }
}
