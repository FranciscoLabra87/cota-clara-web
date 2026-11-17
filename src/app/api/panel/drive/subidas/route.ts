import { getCloudflareContext } from '@opennextjs/cloudflare';
import { errorJson, json } from '@/lib/auth';
import { ErrorDrive, iniciarSubida, type Entorno } from '@/lib/drive';
import { exigirSesionApi } from '@/lib/panel-api';

export const dynamic = 'force-dynamic';

// Abre una subida: revisa tipo, tamaño y cuota, y reserva el espacio. Las
// partes se mandan después a /drive/subidas/:id/partes/:n.
export async function POST(request: Request) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const body = (await request.json().catch(() => null)) as { nombre?: unknown; tamano?: unknown } | null;
  if (!body || typeof body !== 'object') return errorJson('Solicitud inválida', 400);

  const { env } = await getCloudflareContext({ async: true });
  try {
    const subida = await iniciarSubida(env as unknown as Entorno, {
      usuarioId: acceso.sesion.usuario_id,
      nombre: body.nombre,
      tamano: body.tamano,
    });
    return json(subida, 201);
  } catch (e) {
    if (e instanceof ErrorDrive) return errorJson(e.message, e.status);
    throw e;
  }
}
