import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';
import { crearTipologia, ErrorUnidad } from '@/lib/unidades';
import { validarTipologia } from '@/lib/validar-unidad';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

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

  const validacion = validarTipologia(body);
  if (!validacion.ok) return errorJson(validacion.error, 422);

  try {
    const tipologiaId = await crearTipologia(id, validacion.datos);
    await registrar('TIPOLOGIA_CREADA', {
      usuarioId: acceso.sesion.usuario_id,
      detalle: { propiedad_id: id, tipologia_id: tipologiaId },
      ip: ipDe(request),
    });
    return json({ ok: true, id: tipologiaId }, 201);
  } catch (e) {
    if (e instanceof ErrorUnidad) return errorJson(e.message, e.status);
    throw e;
  }
}
