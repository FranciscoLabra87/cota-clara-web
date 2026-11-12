import { errorJson, sesionDeRequest, type Sesion } from './auth';

// Los tres chequeos que repite cada endpoint del panel. Devuelve la respuesta
// de error ya armada en vez de lanzarla, para que la ruta decida cuándo cortar.
export async function exigirSesionApi(
  request: Request,
): Promise<{ ok: true; sesion: Sesion } | { ok: false; respuesta: Response }> {
  const sesion = await sesionDeRequest(request);
  if (!sesion) return { ok: false, respuesta: errorJson('No autenticado', 401) };
  if (sesion.password_temporal) {
    return { ok: false, respuesta: errorJson('Primero cambia tu contraseña', 403, { code: 'PASSWORD_CHANGE_REQUIRED' }) };
  }
  return { ok: true, sesion };
}

/** Id numérico de la URL. Devuelve null si no sirve. */
export function idDeRuta(valor: string): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}
