import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { obtenerDB, obtenerFotos } from '@/lib/db';
import { claveFoto, detectarMime, MAX_BYTES_IMAGEN } from '@/lib/imagenes';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';
import { propiedadPorId, urlFoto } from '@/lib/propiedades';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const MAX_FOTOS = 20;

export async function POST(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Propiedad no válida', 400);
  if (!(await propiedadPorId(id))) return errorJson('No existe esa propiedad', 404);

  const form = await request.formData().catch(() => null);
  const archivo = form?.get('foto');
  if (!archivo || typeof archivo === 'string') return errorJson('Adjunta una imagen en el campo "foto"');
  if (archivo.size < 1) return errorJson('La imagen está vacía');
  if (archivo.size > MAX_BYTES_IMAGEN) return errorJson('La imagen supera los 5 MB');

  const buffer = await archivo.arrayBuffer();
  // Se mira la firma real del archivo, no el Content-Type ni la extensión.
  const mime = detectarMime(new Uint8Array(buffer));
  if (!mime) return errorJson('El archivo no es una imagen JPG, PNG ni WEBP', 422);

  const db = await obtenerDB();
  const cuenta = await db
    .prepare(`SELECT COUNT(*) AS total, COALESCE(MAX(orden), -1) AS ultimo FROM propiedad_fotos WHERE propiedad_id = ?`)
    .bind(id)
    .first<{ total: number; ultimo: number }>();

  if (Number(cuenta?.total ?? 0) >= MAX_FOTOS) {
    return errorJson(`Una propiedad admite hasta ${MAX_FOTOS} fotos. Borra alguna antes de subir otra.`, 409);
  }

  const clave = claveFoto(id, mime);
  const bucket = await obtenerFotos();
  await bucket.put(clave, buffer, { httpMetadata: { contentType: mime } });

  const alt = typeof form?.get('alt') === 'string' ? String(form.get('alt')).trim().slice(0, 160) : '';

  try {
    const fila = await db
      .prepare(`INSERT INTO propiedad_fotos (propiedad_id, clave, alt, orden) VALUES (?, ?, ?, ?) RETURNING id`)
      .bind(id, clave, alt, Number(cuenta?.ultimo ?? -1) + 1)
      .first<{ id: number }>();

    await registrar('FOTO_SUBIDA', { usuarioId: acceso.sesion.usuario_id, detalle: { propiedad_id: id }, ip: ipDe(request) });
    return json({ ok: true, id: fila?.id, url: urlFoto(clave) }, 201);
  } catch (e) {
    // Si la fila no entró, el objeto quedaría huérfano en R2 sin que nada lo
    // referencie ni lo pueda borrar.
    await bucket.delete(clave);
    console.error('[fotos] no se pudo registrar la foto:', e);
    return errorJson('No pudimos guardar la foto', 500);
  }
}
