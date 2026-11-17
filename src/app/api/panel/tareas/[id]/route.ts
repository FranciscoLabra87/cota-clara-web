import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';
import { actualizarTarea, borrarTarea, ErrorTarea, esEstadoTarea, moverTarea, validarTarea } from '@/lib/tareas';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Con `estado` mueve la tarea de columna; sin él, guarda lo editado.
export async function PATCH(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Tarea no válida', 400);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorJson('Solicitud inválida', 400);
  }

  try {
    if ('estado' in body) {
      if (!esEstadoTarea(body.estado)) return errorJson('El estado no es válido', 422);
      await moverTarea(id, body.estado);
      return json({ ok: true });
    }

    const validacion = validarTarea(body);
    if (!validacion.ok) return errorJson(validacion.error, 422);
    await actualizarTarea(id, validacion.datos);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ErrorTarea) return errorJson(e.message, e.status);
    throw e;
  }
}

// La borra quien la creó o un administrador.
export async function DELETE(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Tarea no válida', 400);

  try {
    await borrarTarea(id, acceso.sesion);
    await registrar('TAREA_BORRADA', { usuarioId: acceso.sesion.usuario_id, detalle: { id }, ip: ipDe(request) });
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ErrorTarea) return errorJson(e.message, e.status);
    throw e;
  }
}
