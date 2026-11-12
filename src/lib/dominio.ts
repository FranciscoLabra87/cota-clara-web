import { site } from '@/data/site';

// El sitio responde en más de un host: el dominio público y la dirección
// `…workers.dev` que entrega Cloudflare. Solo el primero debe llegar a los
// buscadores; el otro es una copia que competiría con el dominio real.

const hostPublico = new URL(site.url).hostname.replace(/^www\./, '');

/** ¿El host de la petición es el dominio público, con o sin `www`? */
export function esDominioPublico(host: string | null | undefined): boolean {
  if (!host) return false;
  const limpio = host.trim().toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');
  return limpio === hostPublico;
}
