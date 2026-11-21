import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';
import { actualizarUnidad, eliminarUnidad, ErrorUnidad } from '@/lib/unidades';
import { validarUnidad } from '@/lib/validar-unidad';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; unidadId: string }> };

async function ids(params: Params['params']) {
  const { id, unidadId } = await params;
  return { propiedadId: idDeRuta(id), unidadId: idDeRuta(unidadId) };
}

export async function PUT(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const { propiedadId, unidadId } = await ids(params);
  if (!propiedadId || !unidadId) return errorJson('Unidad no válida', 400);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorJson('Solicitud inválida', 400);
  }

  const validacion = validarUnidad(body);
  if (!validacion.ok) return errorJson(validacion.error, 422);

  try {
    await actualizarUnidad(propiedadId, unidadId, validacion.datos);
    await registrar('UNIDAD_EDITADA', {
      usuarioId: acceso.sesion.usuario_id,
      detalle: { propiedad_id: propiedadId, unidad_id: unidadId },
      ip: ipDe(request),
    });
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ErrorUnidad) return errorJson(e.message, e.status);
    throw e;
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const { propiedadId, unidadId } = await ids(params);
  if (!propiedadId || !unidadId) return errorJson('Unidad no válida', 400);

  try {
    await eliminarUnidad(propiedadId, unidadId);
    await registrar('UNIDAD_BORRADA', {
      usuarioId: acceso.sesion.usuario_id,
      detalle: { propiedad_id: propiedadId, unidad_id: unidadId },
      ip: ipDe(request),
    });
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ErrorUnidad) return errorJson(e.message, e.status);
    throw e;
  }
}
