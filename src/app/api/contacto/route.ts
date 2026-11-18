import { motivosFicha, tituloPropiedad } from '@/data/properties';
import { site } from '@/data/site';
import { ipDe } from '@/lib/auth';
import { interesadoDesdeSolicitud } from '@/lib/crm';
import { formatPrecio, periodoPrecio } from '@/lib/format';
import { enviarConfirmacion, enviarLead, type FichaLead, type Lead } from '@/lib/leads';
import { publicadaParaAviso } from '@/lib/propiedades';
import { guardarSolicitud, marcarCorreo, superaConfirmaciones, superaElTope } from '@/lib/solicitudes';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const texto = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const json = (cuerpo: unknown, status = 200) => Response.json(cuerpo, { status });

/**
 * La confirmación a la persona. Solo sale si la solicitud quedó guardada, que
 * es lo que el correo afirma, y si esa casilla no superó su tope del día. Si
 * la base no deja medir el tope, no se manda: ante la duda, no escribirle a
 * un correo que pudo poner cualquiera.
 */
async function confirmar(lead: Lead, ficha: FichaLead | null): Promise<string> {
  if (await superaConfirmaciones(lead.email).catch(() => true)) return 'omitida';
  return (await enviarConfirmacion(lead, ficha)).estado;
}

/**
 * La propiedad por la que se pregunta, leída de la base con el slug que manda
 * la ficha. Si no existe o no está publicada, el aviso sale igual, solo con el
 * slug: el lead no se pierde por eso.
 */
async function fichaDe(slug: string): Promise<FichaLead | null> {
  if (!slug) return null;
  const p = await publicadaParaAviso(slug).catch(() => null);
  if (!p) return null;
  const periodo = periodoPrecio(p.precio);
  return {
    titulo: tituloPropiedad(p),
    precio: `${formatPrecio(p.precio)}${periodo ? ` ${periodo}` : ''} · ${p.operacion === 'venta' ? 'Venta' : 'Arriendo'}`,
    url: `${site.url}/propiedades/${p.slug}`,
    panel: `${site.url}/panel/propiedades/${p.id}/seguimiento`,
  };
}

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

  if (lead.nombre.length < 2 || !EMAIL.test(lead.email) || !texto(body.acepto) || (lead.variante === 'contacto' && lead.mensaje.length < 10)) {
    return json({ ok: false, error: 'Faltan datos obligatorios' }, 422);
  }

  // Desde la ficha solo hay dos motivos; cualquier otra cosa es pedir información.
  if (lead.variante === 'visita' && !(motivosFicha as readonly string[]).includes(lead.motivo)) lead.motivo = motivosFicha[0];

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

  // Una visita pedida desde una ficha entra también al CRM de esa propiedad.
  // Si eso falla, la solicitud igual quedó guardada: no se corta la respuesta.
  if (id !== null) {
    await interesadoDesdeSolicitud(id, lead).catch((e) =>
      console.error('[lead] no se pudo pasar al CRM:', e instanceof Error ? e.message : 'error desconocido'),
    );
  }

  // El aviso con todos los datos va al equipo (contacto@), que es el respaldo
  // por correo; la confirmación, a la persona. Salen en paralelo.
  const ficha = await fichaDe(lead.propiedad);
  const [envio, confirmacion] = await Promise.all([enviarLead(lead, ficha), id !== null ? confirmar(lead, ficha) : 'sin-guardar']);
  if (id !== null) await marcarCorreo(id, envio.estado).catch(() => {});

  // En el log van el id y el estado, nunca los datos de la persona.
  if (envio.estado === 'error') console.error('[lead] no se pudo enviar el aviso por correo', id ?? 'sin guardar');
  if (confirmacion === 'error') console.error('[lead] no se pudo enviar la confirmación', id);
  if (confirmacion === 'omitida') console.warn('[lead] confirmación omitida por el tope de ese correo', id);
  if (envio.estado === 'sin-configurar') console.warn('[lead] falta configurar SMTP: la solicitud queda solo en el panel');

  // Guardada o avisada por correo: de cualquiera de las dos formas llegó.
  if (id !== null || envio.estado === 'enviado') {
    console.info('[lead] recibida', id ?? 'sin guardar', envio.estado, confirmacion);
    return json({ ok: true });
  }

  // Ni guardada ni avisada: recién ahí se le dice a la persona que no llegó.
  if (envio.estado === 'sin-configurar') {
    return json({ ok: false, error: 'El formulario no está disponible temporalmente' }, 503);
  }
  return json({ ok: false, error: 'No pudimos enviar tu solicitud' }, 502);
}
