import { configuracionSmtp, enviarSmtp, type MensajeSmtp, type ResultadoSmtp } from './smtp';

// Puerta única del correo saliente: avisos al equipo, confirmaciones y
// respuestas desde el panel.
//
// Con RESEND_API_KEY y LEADS_FROM sale por Resend, que no necesita una casilla
// real: el remitente (info@cotaclara.cl) solo tiene que ser del dominio
// verificado en Resend. Sin la clave, cae al SMTP del hosting (smtp.ts).

export type MensajeCorreo = MensajeSmtp;
export type ResultadoCorreo = ResultadoSmtp;

const RESEND_URL = 'https://api.resend.com/emails';

function resend(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.LEADS_FROM?.trim();
  return apiKey && from ? { apiKey, from } : null;
}

/** Indica si hay por dónde mandar correos; no prueba la conexión. */
export function configuracionCorreo(): { lista: true; via: 'resend' | 'smtp' } | { lista: false; detalle: string } {
  if (resend()) return { lista: true, via: 'resend' };
  const smtp = configuracionSmtp();
  return smtp.lista ? { lista: true, via: 'smtp' } : { lista: false, detalle: smtp.detalle };
}

export async function enviarCorreo(mensaje: MensajeCorreo): Promise<ResultadoCorreo> {
  const cuenta = resend();
  return cuenta ? enviarResend(cuenta, mensaje) : enviarSmtp(mensaje);
}

type RespuestaResend = { id?: string; name?: string; message?: string };

async function enviarResend({ apiKey, from }: { apiKey: string; from: string }, mensaje: MensajeCorreo): Promise<ResultadoCorreo> {
  // Resend arma su propio Message-ID: el de la respuesta del panel se manda
  // como cabecera aparte para poder rastrearla igual.
  const headers = { ...mensaje.headers, ...(mensaje.messageId ? { 'X-Cota-Ref': mensaje.messageId } : {}) };

  let res: Response;
  try {
    res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: Array.isArray(mensaje.to) ? mensaje.to : [mensaje.to],
        subject: mensaje.subject,
        text: mensaje.text,
        html: mensaje.html,
        reply_to: mensaje.replyTo,
        headers: Object.keys(headers).length ? headers : undefined,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    // Sin respuesta no se sabe si Resend lo tomó: reenviar podría duplicarlo.
    return { estado: 'incierto', detalle: error instanceof Error ? error.message : 'Fallo de red con Resend' };
  }

  const cuerpo = (await res.json().catch(() => ({}))) as RespuestaResend;
  if (res.ok) {
    return cuerpo.id ? { estado: 'enviado', id: cuerpo.id } : { estado: 'incierto', detalle: 'Resend aceptó el correo sin devolver id.' };
  }
  const detalle = `Resend ${res.status}${cuerpo.name ? ` ${cuerpo.name}` : ''}${cuerpo.message ? `: ${cuerpo.message}` : ''}`;
  // Un 4xx es un rechazo claro (clave, remitente, límite). Un 5xx no dice si
  // alcanzó a salir.
  return { estado: res.status >= 500 ? 'incierto' : 'error', detalle };
}
