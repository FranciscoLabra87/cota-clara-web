// Columnas del kanban de tareas. Van aparte de tareas.ts para que el tablero,
// que corre en el navegador, no arrastre el acceso a la base.

export const ESTADOS_TAREA = [
  { value: 'pendiente', label: 'Por hacer' },
  { value: 'en_curso', label: 'En curso' },
  { value: 'hecha', label: 'Hecha' },
] as const;

export type EstadoTarea = (typeof ESTADOS_TAREA)[number]['value'];

export const esEstadoTarea = (v: unknown): v is EstadoTarea => ESTADOS_TAREA.some((e) => e.value === v);
export const nombreEstadoTarea = (estado: string) => ESTADOS_TAREA.find((e) => e.value === estado)?.label ?? estado;
