import { getCloudflareContext } from '@opennextjs/cloudflare';
import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { cancelarSubida, completarSubida, ErrorDrive, type Entorno } from '@/lib/drive';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Cierra la subida: R2 arma el archivo con las partes y se confirma el tamaño.
export async function POST(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Subida no válida', 400);

  const body = (await request.json().catch(() => null)) as { partes?: unknown } | null;
  const { env } = await getCloudflareContext({ async: true });
  try {
    const archivo = await completarSubida(env as unknown as Entorno, { id, usuarioId: acceso.sesion.usuario_id, partes: body?.partes });
    await registrar('DRIVE_ARCHIVO_SUBIDO', {
      usuarioId: acceso.sesion.usuario_id,
      detalle: { id: archivo.id, tamano: archivo.tamano },
      ip: ipDe(request),
    });
    return json({ ok: true, ...archivo });
  } catch (e) {
    if (e instanceof ErrorDrive) return errorJson(e.message, e.status);
    throw e;
  }
}

// Cancela una subida a medias y libera la cuota que tenía reservada.
export async function DELETE(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Subida no válida', 400);

  const { env } = await getCloudflareContext({ async: true });
  try {
    await cancelarSubida(env as unknown as Entorno, { id, usuarioId: acceso.sesion.usuario_id });
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ErrorDrive) return errorJson(e.message, e.status);
    throw e;
  }
}
