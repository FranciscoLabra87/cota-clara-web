import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { exigirSesionApi } from '@/lib/panel-api';
import { crearPropiedad, slugEnUso } from '@/lib/propiedades';
import { validarPropiedad } from '@/lib/validar-propiedad';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorJson('Solicitud inválida', 400);
  }

  const validacion = validarPropiedad(body);
  if (!validacion.ok) return errorJson(validacion.error, 422);

  if (await slugEnUso(validacion.datos.slug)) {
    return errorJson('Ya hay una propiedad con ese enlace. Cámbialo.', 409);
  }

  const id = await crearPropiedad(validacion.datos);
  await registrar('PROPIEDAD_CREADA', {
    usuarioId: acceso.sesion.usuario_id,
    detalle: { id, slug: validacion.datos.slug },
    ip: ipDe(request),
  });

  return json({ ok: true, id, slug: validacion.datos.slug }, 201);
}
