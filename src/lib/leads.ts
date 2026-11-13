import { Resend } from 'resend';
import { site } from '@/data/site';

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
const ORDEN: (keyof Lead)[] = ['nombre', 'email', 'telefono', 'tipo', 'comuna', 'motivo', 'fecha', 'propiedad', 'mensaje'];

const TITULOS: Record<string, string> = {
  tasacion: 'Solicitud de tasación',
  visita: 'Solicitud de visita',
  contacto: 'Consulta desde el sitio',
};

const escapar = (valor: string) =>
  valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const llenos = (lead: Lead) => ORDEN.map((clave) => [ETIQUETAS[clave], lead[clave]] as const).filter(([, valor]) => valor);

export function asuntoLead(lead: Lead) {
  const titulo = TITULOS[lead.variante] ?? 'Nuevo contacto';
  const detalle = lead.propiedad || lead.comuna;
  return detalle ? `${titulo} · ${lead.nombre} · ${detalle}` : `${titulo} · ${lead.nombre}`;
}

export function textoLead(lead: Lead) {
  const filas = llenos(lead).map(([etiqueta, valor]) => `${etiqueta}: ${valor}`);
  return [asuntoLead(lead), '', ...filas, '', `Responde este correo para contestarle directo a ${lead.nombre}.`].join('\n');
}

export function htmlLead(lead: Lead) {
  const filas = llenos(lead)
    .map(
      ([etiqueta, valor]) => `<tr>
        <th align="left" style="padding:10px 16px 10px 0;border-bottom:1px solid ${GRIS};color:${AZUL};font-weight:600;vertical-align:top;white-space:nowrap">${escapar(etiqueta)}</th>
        <td style="padding:10px 0;border-bottom:1px solid ${GRIS};color:${CARBON};vertical-align:top">${escapar(valor).replace(/\n/g, '<br>')}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="es-CL">
  <body style="margin:0;padding:24px;background:#f6f6f6;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:${CARBON}">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-top:4px solid ${TERRACOTA};padding:24px">
      <p style="margin:0 0 4px;color:${AZUL};font-size:18px;font-weight:700">${escapar(asuntoLead(lead))}</p>
      <p style="margin:0 0 20px;color:${CARBON};opacity:.7">Llegó desde ${escapar(site.url)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${filas}</table>
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

export async function enviarLead(lead: Lead): Promise<EnvioLead> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEADS_FROM;

  // Sin credenciales no sale el aviso por correo. La solicitud igual queda
  // guardada en la base antes de llegar acá: ver src/app/api/contacto/route.ts.
  if (!apiKey || !from) return { estado: 'sin-configurar' };

  try {
    const { data, error } = await new Resend(apiKey).emails.send({
      from,
      to: destinos(),
      replyTo: lead.email,
      subject: asuntoLead(lead),
      text: textoLead(lead),
      html: htmlLead(lead),
      // Resend solo acepta tags con letras, números, guion y guion bajo: no pasamos
      // la variante en crudo, que viene del request.
      tags: [{ name: 'variante', value: TITULOS[lead.variante] ? lead.variante : 'contacto' }],
    });

    if (error) return { estado: 'error', detalle: `${error.name}: ${error.message}` };
    return { estado: 'enviado', id: data?.id ?? '' };
  } catch (e) {
    return { estado: 'error', detalle: e instanceof Error ? e.message : 'fallo de red' };
  }
}
