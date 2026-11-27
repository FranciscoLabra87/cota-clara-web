import { obtenerFotos } from '@/lib/db';
import { videoPublicadoPorSlug } from '@/lib/propiedades';

// El bucket permanece privado. La URL pública usa el slug y vuelve a comprobar
// que la propiedad esté publicada antes de revelar un solo byte del MP4.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };
type Rango = { offset: number; length: number };

const noEncontrado = () => new Response('No encontrado', { status: 404 });

function rangoSolicitado(valor: string, total: number): Rango | null {
  const partes = /^bytes=(\d*)-(\d*)$/i.exec(valor.trim());
  if (!partes || (!partes[1] && !partes[2]) || total < 1) return null;

  if (partes[1]) {
    const inicio = Number(partes[1]);
    const finPedido = partes[2] ? Number(partes[2]) : total - 1;
    if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(finPedido) || inicio >= total || finPedido < inicio) return null;
    const fin = Math.min(finPedido, total - 1);
    return { offset: inicio, length: fin - inicio + 1 };
  }

  const sufijo = Number(partes[2]);
  if (!Number.isSafeInteger(sufijo) || sufijo < 1) return null;
  const length = Math.min(sufijo, total);
  return { offset: total - length, length };
}

function cabecerasVideo(objeto: R2Object): Headers {
  const cabeceras = new Headers();
  objeto.writeHttpMetadata(cabeceras);
  cabeceras.set('Content-Type', 'video/mp4');
  cabeceras.set('Content-Disposition', 'inline');
  cabeceras.set('Accept-Ranges', 'bytes');
  cabeceras.set('X-Content-Type-Options', 'nosniff');
  cabeceras.set('ETag', objeto.httpEtag);
  // Revalida porque el archivo puede cambiar o la ficha quedar despublicada.
  cabeceras.set('Cache-Control', 'public, no-cache');
  return cabeceras;
}

async function resolver(slug: string) {
  const clave = await videoPublicadoPorSlug(slug);
  if (!clave) return null;
  return { clave, bucket: await obtenerFotos() };
}

export async function HEAD(request: Request, { params }: Params) {
  const recurso = await resolver((await params).slug);
  if (!recurso) return noEncontrado();

  const objeto = await recurso.bucket.head(recurso.clave);
  if (!objeto) return noEncontrado();
  const cabeceras = cabecerasVideo(objeto);
  cabeceras.set('Content-Length', String(objeto.size));
  if (request.headers.get('If-None-Match') === objeto.httpEtag) return new Response(null, { status: 304, headers: cabeceras });
  return new Response(null, { headers: cabeceras });
}

export async function GET(request: Request, { params }: Params) {
  const recurso = await resolver((await params).slug);
  if (!recurso) return noEncontrado();

  const pedido = request.headers.get('Range');
  if (pedido) {
    const metadatos = await recurso.bucket.head(recurso.clave);
    if (!metadatos) return noEncontrado();

    // Si cambió el objeto desde que el navegador guardó If-Range, corresponde
    // entregar el archivo completo y no combinar bytes de dos versiones.
    const ifRange = request.headers.get('If-Range');
    if (!ifRange || ifRange === metadatos.httpEtag) {
      const rango = rangoSolicitado(pedido, metadatos.size);
      if (!rango) {
        const cabeceras = cabecerasVideo(metadatos);
        cabeceras.set('Content-Range', `bytes */${metadatos.size}`);
        return new Response(null, { status: 416, headers: cabeceras });
      }

      const objeto = await recurso.bucket.get(recurso.clave, { range: rango });
      if (!objeto) return noEncontrado();
      const cabeceras = cabecerasVideo(objeto);
      cabeceras.set('Content-Length', String(rango.length));
      cabeceras.set('Content-Range', `bytes ${rango.offset}-${rango.offset + rango.length - 1}/${objeto.size}`);
      return new Response(objeto.body, { status: 206, headers: cabeceras });
    }
  }

  const objeto = await recurso.bucket.get(recurso.clave);
  if (!objeto) return noEncontrado();
  const cabeceras = cabecerasVideo(objeto);
  cabeceras.set('Content-Length', String(objeto.size));
  if (request.headers.get('If-None-Match') === objeto.httpEtag) return new Response(null, { status: 304, headers: cabeceras });
  return new Response(objeto.body, { headers: cabeceras });
}
