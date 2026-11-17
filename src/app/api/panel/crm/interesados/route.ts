import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { crearInteresado, ErrorCrm, validarInteresado } from '@/lib/crm';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';

export const dynamic = 'force-dynamic';

// Agrega un interesado al tablero de una propiedad. Lo puede hacer cualquiera
// del equipo: el CRM es compartido.
export async function POST(request: Request) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorJson('Solicitud inválida', 400);
  }

  const propiedadId = idDeRuta(String(body.propiedadId ?? ''));
  if (!propiedadId) return errorJson('Propiedad no válida', 400);

  const validacion = validarInteresado(body);
  if (!validacion.ok) return errorJson(validacion.error, 422);

  try {
    const id = await crearInteresado(propiedadId, validacion.datos, acceso.sesion.usuario_id);
    // En la bitácora van los ids, no el nombre ni el teléfono del cliente.
    await registrar('CRM_INTERESADO_CREADO', { usuarioId: acceso.sesion.usuario_id, detalle: { id, propiedadId }, ip: ipDe(request) });
    return json({ ok: true, id }, 201);
  } catch (e) {
    if (e instanceof ErrorCrm) return errorJson(e.message, e.status);
    throw e;
  }
}
