import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';
import { eliminarSolicitud } from '@/lib/solicitudes';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Borrar una solicitud es lo que cumple la promesa de privacidad del sitio:
// quien escribió puede pedir que se eliminen sus datos.
export async function DELETE(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Solicitud no válida', 400);

  if (!(await eliminarSolicitud(id))) return errorJson('No existe esa solicitud', 404);

  // En la bitácora queda quién la borró y cuál, sin los datos de la persona.
  await registrar('SOLICITUD_ELIMINADA', { usuarioId: acceso.sesion.usuario_id, detalle: { id }, ip: ipDe(request) });
  return json({ ok: true });
}
