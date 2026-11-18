import { MOTIVO_REUNION } from '@/data/properties';
import { site } from '@/data/site';
import { enviarCorreo } from './correo';

export type Lead = {
  variante: string;
  nombre: string;
  email: string;
  telefono: string;
  tipo: string;
  comuna: string;
  motivo: string;
  fecha: string;
  mensaje: string;
  propiedad: string;
};

/**
 * La propiedad consultada desde su ficha, leída de la base a partir del slug.
 * El formulario solo manda el slug: el nombre, el precio y los enlaces salen
 * de acá, nunca de lo que escribió la persona.
 */
export type FichaLead = {
  titulo: string;
  precio: string;
  url: string;
  panel: string;
};

export type EnvioLead =
  | { estado: 'enviado'; id: string }
  | { estado: 'sin-configurar' }
  | { estado: 'error'; detalle: string };

// Los clientes de correo no soportan variables CSS: aquí los colores van en duro.
const AZUL = '#0B2F4A';
const TERRACOTA = '#C65A32';
const CARBON = '#222222';
const GRIS = '#E6E6E6';

const ETIQUETAS: Record<keyof Lead, string> = {
  variante: 'Formulario',
  nombre: 'Nombre',
  email: 'Correo',
  telefono: 'Teléfono',
  tipo: 'Tipo de propiedad',
  comuna: 'Comuna',
  motivo: 'Motivo',
  fecha: 'Fecha preferida',
  mensaje: 'Mensaje',
  propiedad: 'Propiedad',
};

// Orden de lectura en el correo; `variante` va en el asunto, no en la tabla.
const ORDEN: (keyof Lead)[] = ['nombre', 'email', 'telefono', 'propiedad', 'tipo', 'comuna', 'motivo', 'fecha', 'mensaje'];

const TITULOS: Record<string, string> = {
  tasacion: 'Solicitud de tasación',
  visita: 'Consulta por propiedad',
  contacto: 'Consulta desde el sitio',
};

const esReunion = (lead: Lead) => lead.variante === 'visita' && lead.motivo === MOTIVO_REUNION;

const escapar = (valor: string) =>
  valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const llenos = (lead: Lead, ficha?: FichaLead | null) =>
  ORDEN.map((clave) => [ETIQUETAS[clave], clave === 'propiedad' && ficha ? `${ficha.titulo} · ${ficha.precio}` : lead[clave]] as const).filter(
    ([, valor]) => valor,
  );

export function asuntoLead(lead: Lead, ficha?: FichaLead | null) {
  const titulo = esReunion(lead) ? 'Solicitud de reunión' : (TITULOS[lead.variante] ?? 'Nuevo contacto');
  const detalle = ficha?.titulo || lead.propiedad || lead.comuna;
  return detalle ? `${titulo} · ${lead.nombre} · ${detalle}` : `${titulo} · ${lead.nombre}`;
}

export function textoLead(lead: Lead, ficha?: FichaLead | null) {
  const filas = llenos(lead, ficha).map(([etiqueta, valor]) => `${etiqueta}: ${valor}`);
  const enlaces = ficha ? ['', `Ver la propiedad: ${ficha.url}`, `Seguimiento en el panel: ${ficha.panel}`] : [];
  return [asuntoLead(lead, ficha), '', ...filas, ...enlaces, '', `Responde este correo para contestarle directo a ${lead.nombre}.`].join('\n');
}

export function htmlLead(lead: Lead, ficha?: FichaLead | null) {
  const filas = llenos(lead, ficha)
    .map(
      ([etiqueta, valor]) => `<tr>
        <th align="left" style="padding:10px 16px 10px 0;border-bottom:1px solid ${GRIS};color:${AZUL};font-weight:600;vertical-align:top;white-space:nowrap">${escapar(etiqueta)}</th>
        <td style="padding:10px 0;border-bottom:1px solid ${GRIS};color:${CARBON};vertical-align:top">${escapar(valor).replace(/\n/g, '<br>')}</td>
      </tr>`,
    )
    .join('');
  const enlaces = ficha
    ? `<p style="margin:20px 0 0">
        <a href="${escapar(ficha.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;background:${TERRACOTA};color:#ffffff;text-decoration:none;font-weight:600">Ver la propiedad</a>
        <a href="${escapar(ficha.panel)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border:1px solid ${AZUL};color:${AZUL};text-decoration:none;font-weight:600">Seguimiento en el panel</a>
      </p>`
    : '';

  return `<!doctype html>
<html lang="es-CL">
  <body style="margin:0;padding:24px;background:#f6f6f6;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:${CARBON}">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-top:4px solid ${TERRACOTA};padding:24px">
      <p style="margin:0 0 4px;color:${AZUL};font-size:18px;font-weight:700">${escapar(asuntoLead(lead, ficha))}</p>
      <p style="margin:0 0 20px;color:${CARBON};opacity:.7">Llegó desde ${escapar(site.url)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${filas}</table>
      ${enlaces}
      <p style="margin:20px 0 0;color:${CARBON};opacity:.7">Responde este correo para contestarle directo a ${escapar(lead.nombre)}.</p>
    </div>
  </body>
</html>`;
}

const destinos = () =>
  (process.env.LEADS_TO || site.email)
    .split(',')
    .map((valor) => valor.trim())
    .filter(Boolean);

// ─── Confirmación a quien llenó el formulario ───
//
// Sale del mismo remitente que todo lo automático (LEADS_FROM, info@cotaclara.cl),
// que es el «no responder». Reply-To va a contacto@ igual: si la persona
// contesta de todos modos, su correo no se pierde.
//
// El formulario es público y cualquiera puede escribir el correo de otro, así
// que este mensaje no repite nada de lo que se escribió: ni el mensaje ni la
// comuna, y del nombre solo el primero, y solo si son letras. Si no, alguien
// podría usar el formulario para mandarle su texto a terceros desde nuestro
// servidor. El nombre de la propiedad sí va, porque sale de la base.

const QUE_SE_PIDIO: Record<string, string> = {
  tasacion: 'Tu solicitud de tasación',
  visita: 'Tu consulta por la propiedad',
  contacto: 'Tu solicitud de información',
};

export const ASUNTO_CONFIRMACION = 'Tu solicitud fue ingresada con éxito · Cota Clara';

/** El primer nombre, solo si son letras (con tilde, apóstrofo o guion). */
export function saludo(nombre: string) {
  const primero = nombre.trim().split(/\s+/)[0] ?? '';
  return /^\p{L}[\p{L}'’-]{1,29}$/u.test(primero) ? `Hola, ${primero}:` : 'Hola:';
}

function queSePidio(lead: Lead, ficha?: FichaLead | null) {
  if (lead.variante === 'visita' && ficha) {
    return esReunion(lead) ? `Tu solicitud de reunión por «${ficha.titulo}»` : `Tu consulta por «${ficha.titulo}»`;
  }
  if (esReunion(lead)) return 'Tu solicitud de reunión';
  return QUE_SE_PIDIO[lead.variante] ?? 'Tu solicitud de información';
}

const parrafosConfirmacion = (lead: Lead, ficha?: FichaLead | null) => [
  `${queSePidio(lead, ficha)} fue ingresada con éxito. Nuestro equipo la revisará y te contactaremos dentro de un día hábil.`,
  `Si quieres agregar algo, escríbenos a ${site.email} o llámanos al ${site.telefono}.`,
];

const NO_RESPONDER = 'Este es un correo automático, por favor no lo respondas.';

export function textoConfirmacion(lead: Lead, ficha?: FichaLead | null) {
  return [
    saludo(lead.nombre),
    '',
    ...parrafosConfirmacion(lead, ficha).flatMap((p) => [p, '']),
    ...(ficha ? [`Ver la propiedad: ${ficha.url}`, ''] : []),
    `${site.nombre} · ${site.bajada}`,
    site.lema,
    site.url,
    '',
    NO_RESPONDER,
  ].join('\n');
}

export function htmlConfirmacion(lead: Lead, ficha?: FichaLead | null) {
  const parrafos = parrafosConfirmacion(lead, ficha)
    .map((p) => `<p style="margin:0 0 16px">${escapar(p)}</p>`)
    .join('');
  const boton = ficha
    ? `<p style="margin:0 0 16px"><a href="${escapar(ficha.url)}" style="display:inline-block;padding:10px 16px;background:${TERRACOTA};color:#ffffff;text-decoration:none;font-weight:600">Ver la propiedad</a></p>`
    : '';
  return `<!doctype html>
<html lang="es-CL">
  <body style="margin:0;padding:24px;background:#f6f6f6;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:${CARBON}">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-top:4px solid ${TERRACOTA};padding:24px">
      <p style="margin:0 0 16px;color:${AZUL};font-size:18px;font-weight:700">${escapar(saludo(lead.nombre))}</p>
      ${parrafos}
      ${boton}
      <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid ${GRIS};color:${AZUL};font-weight:700">${escapar(site.nombre)} · ${escapar(site.bajada)}</p>
      <p style="margin:0;color:${CARBON};font-style:italic">${escapar(site.lema)}</p>
      <p style="margin:0"><a href="${escapar(site.url)}" style="color:${AZUL}">${escapar(site.url.replace(/^https:\/\//, ''))}</a></p>
      <p style="margin:20px 0 0;font-size:13px;color:${CARBON};opacity:.7">${escapar(NO_RESPONDER)}</p>
    </div>
  </body>
</html>`;
}

/** Le confirma a la persona que su solicitud quedó ingresada. */
export async function enviarConfirmacion(lead: Lead, ficha?: FichaLead | null): Promise<EnvioLead> {
  const envio = await enviarCorreo({
    to: lead.email,
    replyTo: site.email,
    subject: ASUNTO_CONFIRMACION,
    text: textoConfirmacion(lead, ficha),
    html: htmlConfirmacion(lead, ficha),
    // Para que los buzones no le contesten con su propia respuesta automática.
    headers: { 'Auto-Submitted': 'auto-generated' },
  });
  if (envio.estado === 'incierto') return { estado: 'error', detalle: `Confirmación sin confirmar: ${envio.detalle}` };
  return envio;
}

export async function enviarLead(lead: Lead, ficha?: FichaLead | null): Promise<EnvioLead> {
  // La solicitud se guarda en D1 antes de llegar acá. El correo es un aviso
  // al equipo (por Resend o el SMTP del hosting), nunca el registro principal.
  const envio = await enviarCorreo({
    to: destinos(),
    replyTo: lead.email,
    subject: asuntoLead(lead, ficha),
    text: textoLead(lead, ficha),
    html: htmlLead(lead, ficha),
  });
  if (envio.estado === 'incierto') return { estado: 'error', detalle: `Aviso sin confirmar: ${envio.detalle}` };
  return envio;
}
