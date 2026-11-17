import { errorJson, json } from '@/lib/auth';
import { ErrorCrm, esTipoManual, MAX_DETALLE, registrarActividad } from '@/lib/crm';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Anota una llamada, una visita física, un mensaje o una nota. Quién la hizo
// sale de la sesión, no del formulario.
export async function POST(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Interesado no válido', 400);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorJson('Solicitud inválida', 400);
  }

  if (!esTipoManual(body.tipo)) return errorJson('Elige qué quieres registrar', 422);
  const detalle = typeof body.detalle === 'string' ? body.detalle.trim() : '';
  if (detalle.length > MAX_DETALLE) return errorJson(`La observación pasa de ${MAX_DETALLE} caracteres`, 422);

  try {
    const actividadId = await registrarActividad(id, body.tipo, detalle, acceso.sesion.usuario_id);
    return json({ ok: true, id: actividadId }, 201);
  } catch (e) {
    if (e instanceof ErrorCrm) return errorJson(e.message, e.status);
    throw e;
  }
}
