import { site } from '@/data/site';
import { enviarSmtp, type ResultadoSmtp } from './smtp';

type DatosRespuesta = {
  id: number;
  nombre: string;
  email: string;
  variante: 'contacto' | 'tasacion' | 'visita';
  respuesta: string;
  clave: string;
};

export type EnvioRespuesta = ResultadoSmtp;

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
  const text = `Hola ${nombre.trim()},\n\n${respuesta.trim()}\n\nSaludos,\nEquipo Cota Clara · Patrimonio Inmobiliario`;
  return enviarSmtp({
    to: email,
    replyTo: site.email,
    subject: ASUNTOS[variante],
    text,
    messageId: `<solicitud-${id}-${clave}@cotaclara.cl>`,
  });
}
