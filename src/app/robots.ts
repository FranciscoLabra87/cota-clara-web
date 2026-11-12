import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { site } from '@/data/site';
import { esDominioPublico } from '@/lib/dominio';

// Fuera del dominio público (la dirección `…workers.dev`, una vista previa)
// se les pide a los buscadores que no entren: si indexan esa copia, compite
// con el dominio real y deja en los resultados una dirección que no es la del
// sitio. Leer el host hace que esta ruta se arme en cada petición.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host');

  if (!esDominioPublico(host)) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/acceso', '/panel'] },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
