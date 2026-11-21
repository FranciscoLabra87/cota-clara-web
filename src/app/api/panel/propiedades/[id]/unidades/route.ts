import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { esEstadoUnidad } from '@/data/properties';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';
import { cambiarEstadoUnidades, crearUnidad, ErrorUnidad, stockDeProyecto } from '@/lib/unidades';
import { validarUnidad } from '@/lib/validar-unidad';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** El stock completo del proyecto, como lo ve el panel: con lo vendido y lo bloqueado. */
export async function GET(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Propiedad no válida', 400);

  try {
    return json({ ok: true, ...(await stockDeProyecto(id)) });
  } catch (e) {
    if (e instanceof ErrorUnidad) return errorJson(e.message, e.status);
    throw e;
  }
}

export async function POST(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Propiedad no válida', 400);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorJson('Solicitud inválida', 400);
  }

  const validacion = validarUnidad(body);
  if (!validacion.ok) return errorJson(validacion.error, 422);

  try {
    const unidadId = await crearUnidad(id, validacion.datos);
    await registrar('UNIDAD_CREADA', {
      usuarioId: acceso.sesion.usuario_id,
      detalle: { propiedad_id: id, unidad_id: unidadId },
      ip: ipDe(request),
    });
    return json({ ok: true, id: unidadId }, 201);
  } catch (e) {
    if (e instanceof ErrorUnidad) return errorJson(e.message, e.status);
    throw e;
  }
}

/**
 * Cambia el estado de varias unidades de una vez: es como llega el aviso de la
 * inmobiliaria ("se vendieron la 302 y la 1201").
 */
export async function PATCH(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Propiedad no válida', 400);

  const body = (await request.json().catch(() => null)) as { ids?: unknown; estado?: unknown } | null;
  if (!Array.isArray(body?.ids)) return errorJson('Falta la lista de unidades');
  if (!esEstadoUnidad(body.estado)) return errorJson('El estado de la unidad no es válido', 422);

  const ids = body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length !== body.ids.length) return errorJson('Alguna unidad no es válida', 422);

  try {
    const cambiadas = await cambiarEstadoUnidades(id, ids, body.estado);
    await registrar('UNIDADES_ESTADO', {
      usuarioId: acceso.sesion.usuario_id,
      detalle: { propiedad_id: id, cuantas: cambiadas, estado: body.estado },
      ip: ipDe(request),
    });
    return json({ ok: true, cambiadas });
  } catch (e) {
    if (e instanceof ErrorUnidad) return errorJson(e.message, e.status);
    throw e;
  }
}
