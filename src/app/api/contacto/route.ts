import { ipDe } from '@/lib/auth';
import { enviarLead, type Lead } from '@/lib/leads';
import { guardarSolicitud, marcarCorreo, superaElTope } from '@/lib/solicitudes';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const texto = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const json = (cuerpo: unknown, status = 200) => Response.json(cuerpo, { status });

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'Solicitud inválida' }, 400);
  }

  // Campo trampa para bots: si viene completo, se descarta sin avisar.
  if (texto(body.empresa)) return json({ ok: true });

  const lead: Lead = {
    variante: texto(body.variante, 20),
    nombre: texto(body.nombre, 120),
    email: texto(body.email, 160),
    telefono: texto(body.telefono, 40),
    tipo: texto(body.tipo, 40),
    comuna: texto(body.comuna, 60),
    motivo: texto(body.motivo, 60),
    fecha: texto(body.fecha, 20),
    mensaje: texto(body.mensaje, 2000),
    propiedad: texto(body.propiedad, 120),
  };

  if (lead.nombre.length < 2 || !EMAIL.test(lead.email) || !texto(body.acepto)) {
    return json({ ok: false, error: 'Faltan datos obligatorios' }, 422);
  }

  const ip = ipDe(request);

  // Si la base no responde, el tope no se puede medir: se sigue adelante y el
  // correo queda como único camino.
  if (await superaElTope(ip).catch(() => false)) {
    return json({ ok: false, error: 'Recibimos varias solicitudes seguidas. Inténtalo de nuevo en unos minutos.' }, 429);
  }

  // Primero se guarda y después se avisa. El correo puede fallar o no estar
  // configurado; la solicitud no puede depender de eso.
  let id: number | null = null;
  try {
    id = await guardarSolicitud(lead, ip);
  } catch (e) {
    console.error('[lead] no se pudo guardar:', e instanceof Error ? e.message : 'error desconocido');
  }

  const envio = await enviarLead(lead);
  if (id !== null) await marcarCorreo(id, envio.estado).catch(() => {});

  // En el log van el id y el estado, nunca los datos de la persona.
  if (envio.estado === 'error') console.error('[lead] no se pudo enviar el correo:', envio.detalle);
  if (envio.estado === 'sin-configurar') console.warn('[lead] falta RESEND_API_KEY o LEADS_FROM: la solicitud queda solo en el panel');

  // Guardada o avisada por correo: de cualquiera de las dos formas llegó.
  if (id !== null || envio.estado === 'enviado') {
    console.info('[lead] recibida', id ?? 'sin guardar', envio.estado);
    return json({ ok: true });
  }

  // Ni guardada ni avisada: recién ahí se le dice a la persona que no llegó.
  if (envio.estado === 'sin-configurar') {
    return json({ ok: false, error: 'El formulario no está disponible temporalmente' }, 503);
  }
  return json({ ok: false, error: 'No pudimos enviar tu solicitud' }, 502);
}
