export const CLAVE_COOKIES = 'cota.cookies.v1';
export const VIGENCIA_COOKIES_MS = 180 * 24 * 60 * 60 * 1000;

export type PreferenciasCookies = { version: 1; analitica: boolean; fecha: number };

export function leerPreferenciasCookies(valor: string | null, ahora = Date.now()): PreferenciasCookies | null {
  if (!valor || valor.length > 1024) return null;
  try {
    const dato = JSON.parse(valor) as Partial<PreferenciasCookies> | null;
    if (
      !dato || dato.version !== 1 || typeof dato.analitica !== 'boolean' ||
      typeof dato.fecha !== 'number' || !Number.isFinite(dato.fecha) ||
      dato.fecha > ahora || ahora - dato.fecha >= VIGENCIA_COOKIES_MS
    ) return null;
    return { version: 1, analitica: dato.analitica, fecha: dato.fecha };
  } catch {
    return null;
  }
}

export function idMedicionValido(valor: string | undefined): string | null {
  const id = valor?.trim() ?? '';
  return /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}

export function esPaginaMedible(ruta: string): boolean {
  return !/^\/(panel|acceso|drive|api)(\/|$)/.test(ruta);
}
