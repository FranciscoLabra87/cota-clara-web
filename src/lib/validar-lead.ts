import { motivosFicha, tipos } from '@/data/properties';
import { comunas } from '@/data/site';
import type { Lead } from './leads';

export type VarianteLead = 'tasacion' | 'contacto' | 'visita';
export type ErroresLead = Partial<Record<keyof Lead | 'acepto', string>>;

export const LIMITES_LEAD = {
  variante: 20,
  nombre: 120,
  email: 160,
  telefono: 40,
  tipo: 40,
  comuna: 60,
  motivo: 60,
  fecha: 20,
  mensaje: 2000,
  propiedad: 120,
} as const;

export const MOTIVOS_TASACION = ['Vender', 'Arrendar', 'Herencia o partición', 'Comprar con respaldo', 'Otro'] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COMUNAS_TASACION = [...comunas, 'Otra'];

/** Comprueba el calendario, sin convertir una fecha imposible al mes siguiente. */
export function fechaLeadValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T12:00:00Z`);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor && fecha.getUTCFullYear() > 0;
}

/** La misma validación en el formulario y en la API: no recorta datos en silencio. */
export function validarLead(body: Record<string, unknown>):
  | { ok: true; lead: Lead & { variante: VarianteLead } }
  | { ok: false; errores: ErroresLead } {
  const errores: ErroresLead = {};
  const lead = {} as Lead;

  for (const clave of Object.keys(LIMITES_LEAD) as Array<keyof typeof LIMITES_LEAD>) {
    const valor = body[clave];
    if (valor !== undefined && typeof valor !== 'string') {
      errores[clave] = 'Revisa este dato.';
    }
    const texto = typeof valor === 'string' ? valor.trim() : '';
    lead[clave] = texto;
    if (texto.length > LIMITES_LEAD[clave]) {
      errores[clave] = `Usa como máximo ${LIMITES_LEAD[clave]} caracteres.`;
    } else if (clave === 'mensaje' ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(texto) : /[\u0000-\u001f\u007f]/.test(texto)) {
      errores[clave] = 'El texto contiene caracteres no válidos.';
    }
  }

  // Compatibilidad con solicitudes antiguas: una variante desconocida es contacto,
  // y debe pasar también sus requisitos (incluido el mensaje).
  const variante: VarianteLead = lead.variante === 'tasacion' || lead.variante === 'visita' ? lead.variante : 'contacto';
  lead.variante = variante;
  if (lead.nombre.length < 2) errores.nombre = 'Escribe tu nombre.';
  if (!EMAIL.test(lead.email)) errores.email = 'Escribe un correo válido, por ejemplo nombre@correo.cl.';

  // El teléfono sigue siendo opcional. Si viene, admite formato internacional.
  const digitos = lead.telefono.replace(/\D/g, '');
  if (lead.telefono && (!/^\+?[()\d .-]+$/.test(lead.telefono) || digitos.length < 8 || digitos.length > 15)) {
    errores.telefono = 'Revisa el teléfono: debe tener entre 8 y 15 dígitos.';
  }

  // Se aceptan las etiquetas antiguas y se guarda el valor del selector actual.
  const tipo = tipos.find((t) => t.value === lead.tipo.toLowerCase() || t.label === lead.tipo);
  if (tipo) lead.tipo = tipo.value;
  if (variante === 'tasacion') {
    if (!tipo) errores.tipo = 'Elige el tipo de propiedad.';
    if (!COMUNAS_TASACION.includes(lead.comuna)) errores.comuna = 'Elige la comuna.';
    if (lead.motivo && !(MOTIVOS_TASACION as readonly string[]).includes(lead.motivo)) {
      errores.motivo = 'Elige un motivo válido.';
    }
  }
  if (variante === 'visita') {
    if (!lead.motivo) lead.motivo = motivosFicha[0];
    else if (!(motivosFicha as readonly string[]).includes(lead.motivo)) errores.motivo = 'Elige un motivo válido.';
  }
  if (lead.fecha && !fechaLeadValida(lead.fecha)) errores.fecha = 'Elige una fecha válida.';
  if (variante === 'contacto' && lead.mensaje.length < 10) {
    errores.mensaje = 'Cuéntanos brevemente qué necesitas (al menos 10 caracteres).';
  }
  if (body.acepto !== 'si') errores.acepto = 'Necesitamos tu autorización para contactarte.';

  return Object.keys(errores).length ? { ok: false, errores } : { ok: true, lead: { ...lead, variante } };
}
