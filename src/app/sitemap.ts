import type { MetadataRoute } from 'next';
import { propiedades } from '@/data/properties';
import { servicios } from '@/data/services';
import { site } from '@/data/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url;
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/propiedades`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/contacto`, changeFrequency: 'yearly', priority: 0.5 },
    ...servicios.map((s) => ({ url: `${base}/servicios/${s.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    ...propiedades.map((p) => ({ url: `${base}/propiedades/${p.slug}`, lastModified: p.publicada, changeFrequency: 'weekly' as const, priority: 0.7 })),
  ];
}
