import { obtenerFotos } from '@/lib/db';
import { claveValida } from '@/lib/imagenes';

// Entrega las fotos guardadas en R2. El bucket no es público: todo pasa por
// acá, así que la clave que llega por URL se valida contra el mismo formato
// que genera claveFoto() antes de tocar el bucket.

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ clave: string[] }> };

export async function GET(request: Request, { params }: Params) {
  const clave = (await params).clave.join('/');
  if (!claveValida(clave)) return new Response('No encontrada', { status: 404 });

  const bucket = await obtenerFotos();
  const objeto = await bucket.get(clave);
  if (!objeto) return new Response('No encontrada', { status: 404 });

  const cabeceras = new Headers();
  objeto.writeHttpMetadata(cabeceras);
  // El tipo lo fijó el servidor al subir, tras mirar los bytes reales.
  cabeceras.set('Content-Type', objeto.httpMetadata?.contentType ?? 'application/octet-stream');
  cabeceras.set('X-Content-Type-Options', 'nosniff');
  cabeceras.set('ETag', objeto.httpEtag);
  // La clave lleva un UUID y nunca se reutiliza: el archivo es inmutable.
  cabeceras.set('Cache-Control', 'public, max-age=31536000, immutable');

  if (request.headers.get('If-None-Match') === objeto.httpEtag) {
    return new Response(null, { status: 304, headers: cabeceras });
  }

  return new Response(objeto.body, { headers: cabeceras });
}
