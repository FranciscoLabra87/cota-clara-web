import { cerrarSesion, cookieSesionBorrada, COOKIE_SESION, json, leerCookie, registrar, ipDe, sesionDeRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = leerCookie(request, COOKIE_SESION);
  if (token) {
    const sesion = await sesionDeRequest(request);
    await cerrarSesion(token);
    if (sesion) await registrar('LOGOUT', { usuarioId: sesion.usuario_id, ip: ipDe(request) });
  }
  return json({ ok: true }, 200, { 'Set-Cookie': cookieSesionBorrada(request) });
}
