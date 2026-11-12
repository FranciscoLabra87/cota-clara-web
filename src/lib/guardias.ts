import { redirect } from 'next/navigation';
import { esAdmin, sesionActual, type Sesion } from './auth';

// Guardias para Server Components del panel. Van aparte de auth.ts porque
// `redirect()` lanza una excepción de Next y no sirve dentro de un route
// handler, que tiene que responder un JSON.

// Solo exige sesión. La usa /panel/clave, que es justamente adonde se manda a
// quien todavía tiene la contraseña temporal.
export async function exigirSesionBasica(): Promise<Sesion> {
  const sesion = await sesionActual();
  if (!sesion) redirect('/acceso');
  return sesion;
}

// Sesión con la contraseña ya cambiada: lo normal en el panel.
export async function exigirSesion(): Promise<Sesion> {
  const sesion = await exigirSesionBasica();
  if (sesion.password_temporal) redirect('/panel/clave');
  return sesion;
}

export async function exigirAdmin(): Promise<Sesion> {
  const sesion = await exigirSesion();
  if (!esAdmin(sesion.rol)) redirect('/panel');
  return sesion;
}
