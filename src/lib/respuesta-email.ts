import { Resend } from 'resend';
import { site } from '@/data/site';

type DatosRespuesta = {
  id: number;
  nombre: string;
  email: string;
  variante: 'contacto' | 'tasacion' | 'visita';
  respuesta: string;
  clave: string;
};

export type EnvioRespuesta =
  | { estado: 'enviado'; id: string }
  | { estado: 'sin-configurar' }
  | { estado: 'error'; detalle: string }
  | { estado: 'incierto'; detalle: string };

const ASUNTOS: Record<DatosRespuesta['variante'], string> = {
  contacto: 'Respuesta a tu consulta en Cota Clara',
  tasacion: 'Respuesta a tu solicitud de tasación en Cota Clara',
  visita: 'Respuesta a tu solicitud de visita en Cota Clara',
};

/** Envía una sola respuesta al correo guardado en la solicitud. */
export async function enviarRespuesta({
  id,
  nombre,
  email,
  variante,
  respuesta,
  clave,
}: DatosRespuesta): Promise<EnvioRespuesta> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEADS_FROM;
  if (!apiKey || !from) return { estado: 'sin-configurar' };

  const text = `Hola ${nombre.trim()},\n\n${respuesta.trim()}\n\nSaludos,\nEquipo Cota Clara · Patrimonio Inmobiliario`;

  try {
    const { data, error } = await new Resend(apiKey).emails.send(
      {
        from,
        to: email,
        replyTo: site.email,
        subject: ASUNTOS[variante],
        text,
      },
      { idempotencyKey: `respuesta-solicitud/${id}/${clave}` },
    );

    if (error) return { estado: 'error', detalle: `${error.name}: ${error.message}` };
    if (!data?.id) return { estado: 'incierto', detalle: 'Resend no confirmó el identificador del envío.' };
    return { estado: 'enviado', id: data.id };
  } catch (error) {
    return { estado: 'incierto', detalle: error instanceof Error ? error.message : 'No se pudo confirmar el envío.' };
  }
}
