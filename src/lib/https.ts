import { site } from '@/data/site';
import { esDominioPublico } from './dominio';

/** Conserva ruta, consulta y método (308); localhost y previews siguen utilizables. */
export function redireccionPublica(request: Request): Response | null {
  const actual = new URL(request.url);
  if (!esDominioPublico(actual.hostname)) return null;
  const canonica = new URL(site.url);
  if (actual.protocol === 'https:' && actual.host === canonica.host) return null;
  actual.protocol = 'https:';
  actual.host = canonica.host;
  return new Response(null, { status: 308, headers: { Location: actual.href, 'Cache-Control': 'public, max-age=3600' } });
}

export function protegerHttps(request: Request, response: Response): Response {
  const url = new URL(request.url);
  if (url.protocol !== 'https:' || !esDominioPublico(url.hostname)) return response;
  const headers = new Headers(response.headers);
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
