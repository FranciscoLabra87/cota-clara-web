import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { obtenerFotos } from '@/lib/db';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';
import { actualizarPropiedad, eliminarPropiedad, propiedadPorId, slugEnUso } from '@/lib/propiedades';
import { validarPropiedad } from '@/lib/validar-propiedad';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Propiedad no válida', 400);
  if (!(await propiedadPorId(id))) return errorJson('No existe esa propiedad', 404);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorJson('Solicitud inválida', 400);
  }

  const validacion = validarPropiedad(body);
  if (!validacion.ok) return errorJson(validacion.error, 422);

  if (await slugEnUso(validacion.datos.slug, id)) {
    return errorJson('Ya hay otra propiedad con ese enlace. Cámbialo.', 409);
  }

  await actualizarPropiedad(id, validacion.datos);
  await registrar('PROPIEDAD_EDITADA', {
    usuarioId: acceso.sesion.usuario_id,
    detalle: { id, slug: validacion.datos.slug },
    ip: ipDe(request),
  });

  return json({ ok: true, id, slug: validacion.datos.slug });
}

export async function DELETE(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Propiedad no válida', 400);

  const propiedad = await propiedadPorId(id);
  if (!propiedad) return errorJson('No existe esa propiedad', 404);

  // Las filas de propiedad_fotos caen por ON DELETE CASCADE, pero los objetos
  // de R2 no: hay que borrarlos a mano o quedan ocupando espacio para siempre.
  const claves = await eliminarPropiedad(id);
  if (claves.length) {
    const bucket = await obtenerFotos();
    await Promise.all(claves.map((clave) => bucket.delete(clave)));
  }

  await registrar('PROPIEDAD_ELIMINADA', {
    usuarioId: acceso.sesion.usuario_id,
    detalle: { id, slug: propiedad.slug, fotos: claves.length },
    ip: ipDe(request),
  });

  return json({ ok: true });
}
