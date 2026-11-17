const FORMATO = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' });

/**
 * SQLite entrega la hora en UTC y sin zona ('2026-11-12 23:40:05'). Se pasa a
 * hora de Chile en el servidor: si la armara el navegador, dependería de la
 * zona del computador de quien mira y el HTML del servidor no calzaría.
 */
export const horaDeChile = (utc: string) => FORMATO.format(new Date(`${utc.replace(' ', 'T')}Z`));
