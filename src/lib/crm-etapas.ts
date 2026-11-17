// Etapas del kanban y tipos de actividad del CRM. Van aparte de crm.ts para
// que el tablero, que corre en el navegador, no arrastre el acceso a la base.

export const ETAPAS = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'agendada', label: 'Visita agendada' },
  { value: 'visito', label: 'Visitó' },
  { value: 'negociacion', label: 'Negociación' },
  { value: 'cerrado', label: 'Cerrado' },
  { value: 'descartado', label: 'Descartado' },
] as const;

export type Etapa = (typeof ETAPAS)[number]['value'];

/** Las que el equipo registra a mano. 'etapa' la anota el sistema al mover una tarjeta. */
export const TIPOS_ACTIVIDAD = [
  { value: 'llamada', label: 'Llamada' },
  { value: 'visita', label: 'Visita física' },
  { value: 'mensaje', label: 'WhatsApp o correo' },
  { value: 'nota', label: 'Nota' },
] as const;

export type TipoManual = (typeof TIPOS_ACTIVIDAD)[number]['value'];
export type TipoActividad = TipoManual | 'etapa';

export const nombreEtapa = (etapa: string) => ETAPAS.find((e) => e.value === etapa)?.label ?? etapa;
export const nombreActividad = (tipo: string) =>
  tipo === 'etapa' ? 'Cambio de etapa' : (TIPOS_ACTIVIDAD.find((t) => t.value === tipo)?.label ?? tipo);

export const esEtapa = (v: unknown): v is Etapa => ETAPAS.some((e) => e.value === v);
export const esTipoManual = (v: unknown): v is TipoManual => TIPOS_ACTIVIDAD.some((t) => t.value === v);
