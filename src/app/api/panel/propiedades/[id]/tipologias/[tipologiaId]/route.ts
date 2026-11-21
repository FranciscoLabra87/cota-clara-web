import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';
import { actualizarTipologia, eliminarTipologia, ErrorUnidad } from '@/lib/unidades';
import { validarTipologia } from '@/lib/validar-unidad';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; tipologiaId: string }> };

async function ids(params: Params['params']) {
  const { id, tipologiaId } = await params;
  return { propiedadId: idDeRuta(id), tipologiaId: idDeRuta(tipologiaId) };
}

export async function PUT(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const { propiedadId, tipologiaId } = await ids(params);
  if (!propiedadId || !tipologiaId) return errorJson('Tipología no válida', 400);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorJson('Solicitud inválida', 400);
  }

  const validacion = validarTipologia(body);
  if (!validacion.ok) return errorJson(validacion.error, 422);

  try {
    await actualizarTipologia(propiedadId, tipologiaId, validacion.datos);
    await registrar('TIPOLOGIA_EDITADA', {
      usuarioId: acceso.sesion.usuario_id,
      detalle: { propiedad_id: propiedadId, tipologia_id: tipologiaId },
      ip: ipDe(request),
    });
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ErrorUnidad) return errorJson(e.message, e.status);
    throw e;
  }
}

/** Las unidades que la usaban quedan sin tipología, no se borran con ella. */
export async function DELETE(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const { propiedadId, tipologiaId } = await ids(params);
  if (!propiedadId || !tipologiaId) return errorJson('Tipología no válida', 400);

  try {
    await eliminarTipologia(propiedadId, tipologiaId);
    await registrar('TIPOLOGIA_BORRADA', {
      usuarioId: acceso.sesion.usuario_id,
      detalle: { propiedad_id: propiedadId, tipologia_id: tipologiaId },
      ip: ipDe(request),
    });
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ErrorUnidad) return errorJson(e.message, e.status);
    throw e;
  }
}
