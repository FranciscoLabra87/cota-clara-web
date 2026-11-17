import { getCloudflareContext } from '@opennextjs/cloudflare';
import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { borrarArchivo, ErrorDrive, type Entorno } from '@/lib/drive';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Borra un archivo del Drive: su dueño o un administrador.
export async function DELETE(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Archivo no válido', 400);

  const { env } = await getCloudflareContext({ async: true });
  try {
    await borrarArchivo(env as unknown as Entorno, { id, sesion: acceso.sesion });
    // En la bitácora va el id, no el nombre: puede traer datos de un cliente.
    await registrar('DRIVE_ARCHIVO_BORRADO', { usuarioId: acceso.sesion.usuario_id, detalle: { id }, ip: ipDe(request) });
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ErrorDrive) return errorJson(e.message, e.status);
    throw e;
  }
}
