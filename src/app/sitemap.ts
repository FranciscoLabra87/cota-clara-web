import type { MetadataRoute } from 'next';
import { slugsPublicados } from '@/lib/propiedades';
import { servicios } from '@/data/services';
import { site } from '@/data/site';

// Lee el inventario de D1, así que se arma en cada petición.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url;
  const propiedades = await slugsPublicados();

  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/proyectos-de-inversion`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/retail`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/propiedades`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/contacto`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/privacidad`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terminos`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/cookies`, changeFrequency: 'yearly', priority: 0.3 },
    ...servicios.map((s) => ({ url: `${base}/servicios/${s.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    ...propiedades.map((p) => ({ url: `${base}/propiedades/${p.slug}`, lastModified: p.publicada, changeFrequency: 'weekly' as const, priority: 0.7 })),
  ];
}
