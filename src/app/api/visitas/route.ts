import { sesionDeRequest } from '@/lib/auth';
import { contarVisita } from '@/lib/visitas';

export const dynamic = 'force-dynamic';

// Buscadores, monitores y navegadores automatizados que ejecutan JavaScript
// y alcanzarían a disparar el aviso de visita. No son personas mirando.
const AUTOMATICO = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor/i;

// Recibe el aviso que manda la ficha al abrirse en el navegador. Responde 204
// siempre que el cuerpo sea válido, se cuente o no: no hay nada que mostrar,
// y así tampoco delata qué slugs existen.
export async function POST(request: Request) {
  const cuerpo = (await request.json().catch(() => null)) as { slug?: unknown } | null;
  const slug = typeof cuerpo?.slug === 'string' ? cuerpo.slug.trim() : '';
  if (!slug || slug.length > 120) return new Response(null, { status: 400 });

  const nada = () => new Response(null, { status: 204 });

  if (AUTOMATICO.test(request.headers.get('User-Agent') ?? '')) return nada();

  // Las visitas del equipo no cuentan: revisar una ficha desde el panel no es
  // un interesado. Si la base no responde, se sigue como si no hubiera sesión.
  if (await sesionDeRequest(request).catch(() => null)) return nada();

  try {
    await contarVisita(slug);
  } catch (e) {
    console.error('[visitas] no se pudo contar:', e instanceof Error ? e.message : 'error desconocido');
  }
  return nada();
}
