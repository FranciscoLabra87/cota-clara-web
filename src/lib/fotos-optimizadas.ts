import { claveValida } from './imagenes';

type EntornoFotos = { FOTOS: Pick<R2Bucket, 'get'>; IMAGES?: Pick<ImagesBinding, 'input'> };
const ANCHOS = new Set([160, 256, 384, 640, 750, 828, 1080, 1200, 1920]);
type FormatoFoto = 'image/avif' | 'image/webp' | 'image/jpeg';

function formatoAceptado(accept: string): FormatoFoto | null {
  if (!accept.trim()) return 'image/jpeg';
  const calidades = new Map<string, number>();
  for (const parte of accept.toLowerCase().split(',')) {
    const [tipo, ...parametros] = parte.trim().split(';');
    const parametro = parametros.map((p) => p.trim()).find((p) => p.startsWith('q='));
    const q = parametro ? Number(parametro.slice(2)) : 1;
    calidades.set(tipo, Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0);
  }
  // Un comodín no demuestra que un navegador antiguo pueda decodificar AVIF.
  const opciones: Array<{ formato: FormatoFoto; q: number }> = [
    { formato: 'image/avif', q: calidades.get('image/avif') ?? 0 },
    { formato: 'image/webp', q: calidades.get('image/webp') ?? 0 },
    { formato: 'image/jpeg', q: calidades.get('image/jpeg') ?? calidades.get('image/*') ?? calidades.get('*/*') ?? 0 },
  ];
  opciones.sort((a, b) => b.q - a.q);
  return opciones[0].q > 0 ? opciones[0].formato : null;
}

// El adaptador de Next busca las rutas locales en ASSETS. Las fotos son
// dinámicas (R2), así que se entrega directamente su stream al binding Images.
export async function atenderFotoOptimizada(request: Request, env: EntornoFotos): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/_next/image' && url.pathname !== '/_next/image/') return null;
  const origen = url.searchParams.get('url') ?? '';
  if (!origen.startsWith('/fotos/')) return null;
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
  const clave = origen.slice('/fotos/'.length);
  const ancho = Number(url.searchParams.get('w'));
  if (!claveValida(clave) || !ANCHOS.has(ancho) || url.searchParams.get('q') !== '75') {
    return new Response('Parámetros de imagen inválidos', { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const formato = formatoAceptado(request.headers.get('Accept') ?? '');
  if (!formato) return new Response('Formato de imagen no aceptado', { status: 406 });
  const objeto = await env.FOTOS.get(clave);
  if (!objeto) return new Response('No encontrada', { status: 404 });
  const etag = `"${objeto.etag}-${ancho}-${formato.slice(6)}-75"`;
  const headers = new Headers({
    'Content-Type': formato, 'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff', Vary: 'Accept', ETag: etag,
  });
  if (request.headers.get('If-None-Match') === etag) {
    await objeto.body.cancel();
    return new Response(null, { status: 304, headers });
  }
  if (env.IMAGES) {
    try {
      const salida = await env.IMAGES.input(objeto.body).transform({ width: ancho, fit: 'scale-down' }).output({ format: formato, quality: 75 });
      return salida.response({ headers });
    } catch {
      // Un límite o una incidencia del optimizador no debe ocultar la propiedad.
      console.warn('[fotos] optimización no disponible; se entrega el original');
      const original = await env.FOTOS.get(clave);
      if (!original) return new Response('No encontrada', { status: 404 });
      headers.set('Content-Type', original.httpMetadata?.contentType ?? 'image/jpeg');
      headers.set('Cache-Control', 'public, max-age=60');
      headers.set('ETag', original.httpEtag);
      return new Response(original.body, { headers });
    }
  }
  headers.set('Content-Type', objeto.httpMetadata?.contentType ?? 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=60');
  headers.set('ETag', objeto.httpEtag);
  return new Response(objeto.body, { headers });
}
