import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';
import { cambiarEstado, propiedadPorId, type Estado } from '@/lib/propiedades';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const ESTADOS: Estado[] = ['BORRADOR', 'PUBLICADA'];

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

  const estado = typeof body.estado === 'string' ? body.estado : '';
  if (!ESTADOS.includes(estado as Estado)) return errorJson('El estado no es válido', 422);

  const propiedad = await propiedadPorId(id);
  if (!propiedad) return errorJson('No existe esa propiedad', 404);
  if (estado === 'PUBLICADA' && (propiedad.latitud === undefined || propiedad.longitud === undefined)) {
    return errorJson('Indica latitud y longitud antes de publicar la propiedad', 422);
  }

  await cambiarEstado(id, estado as Estado);
  await registrar(estado === 'PUBLICADA' ? 'PROPIEDAD_PUBLICADA' : 'PROPIEDAD_DESPUBLICADA', {
    usuarioId: acceso.sesion.usuario_id,
    detalle: { id, slug: propiedad.slug },
    ip: ipDe(request),
  });

  return json({ ok: true, estado });
}
