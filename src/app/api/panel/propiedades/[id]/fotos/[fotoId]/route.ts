import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { obtenerDB, obtenerFotos } from '@/lib/db';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; fotoId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const { id: idTexto, fotoId: fotoTexto } = await params;
  const id = idDeRuta(idTexto);
  const fotoId = idDeRuta(fotoTexto);
  if (!id || !fotoId) return errorJson('Foto no válida', 400);

  const db = await obtenerDB();
  // El propiedad_id va en el WHERE: una foto de otra propiedad no se borra
  // aunque se pida con su id.
  const foto = await db
    .prepare(`SELECT clave FROM propiedad_fotos WHERE id = ? AND propiedad_id = ?`)
    .bind(fotoId, id)
    .first<{ clave: string }>();
  if (!foto) return errorJson('No existe esa foto', 404);

  await db.prepare(`DELETE FROM propiedad_fotos WHERE id = ?`).bind(fotoId).run();
  const bucket = await obtenerFotos();
  await bucket.delete(foto.clave);

  await registrar('FOTO_ELIMINADA', { usuarioId: acceso.sesion.usuario_id, detalle: { propiedad_id: id }, ip: ipDe(request) });
  return json({ ok: true });
}
