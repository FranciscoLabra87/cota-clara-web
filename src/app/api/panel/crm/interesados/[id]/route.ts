import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { actualizarInteresado, borrarInteresado, ErrorCrm, esEtapa, moverEtapa, validarInteresado } from '@/lib/crm';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Con `etapa` mueve la tarjeta a otra columna; sin ella, corrige los datos de
// contacto. Son dos cambios distintos y nunca vienen juntos desde el tablero.
export async function PATCH(request: Request, { params }: Params) {
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

  try {
    if ('etapa' in body) {
      if (!esEtapa(body.etapa)) return errorJson('La etapa no es válida', 422);
      await moverEtapa(id, body.etapa, acceso.sesion.usuario_id);
      return json({ ok: true });
    }

    const validacion = validarInteresado(body);
    if (!validacion.ok) return errorJson(validacion.error, 422);
    await actualizarInteresado(id, validacion.datos);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ErrorCrm) return errorJson(e.message, e.status);
    throw e;
  }
}

// Borra al interesado y su historial: quien lo agregó o un administrador.
export async function DELETE(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Interesado no válido', 400);

  try {
    await borrarInteresado(id, acceso.sesion);
    await registrar('CRM_INTERESADO_BORRADO', { usuarioId: acceso.sesion.usuario_id, detalle: { id }, ip: ipDe(request) });
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ErrorCrm) return errorJson(e.message, e.status);
    throw e;
  }
}
