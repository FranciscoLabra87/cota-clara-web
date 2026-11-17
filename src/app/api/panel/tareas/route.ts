import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { exigirSesionApi } from '@/lib/panel-api';
import { crearTarea, ErrorTarea, validarTarea } from '@/lib/tareas';

export const dynamic = 'force-dynamic';

// Crea una tarea. Cualquiera del equipo puede crearla y asignarla.
export async function POST(request: Request) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorJson('Solicitud inválida', 400);
  }

  const validacion = validarTarea(body);
  if (!validacion.ok) return errorJson(validacion.error, 422);

  try {
    const id = await crearTarea(validacion.datos, acceso.sesion.usuario_id);
    await registrar('TAREA_CREADA', { usuarioId: acceso.sesion.usuario_id, detalle: { id }, ip: ipDe(request) });
    return json({ ok: true, id }, 201);
  } catch (e) {
    if (e instanceof ErrorTarea) return errorJson(e.message, e.status);
    throw e;
  }
}
