import type { Metadata } from 'next';
import { site } from '@/data/site';

/** Metadatos de una página pública, sin heredar la canónica de otra ruta. */
export function metadatosPagina(titulo: string, descripcion: string, ruta: string): Metadata {
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: ruta },
    // Next reemplaza los objetos anidados: cada página conserva los datos de
    // marca y la imagen al definir su propio título y URL para compartir.
    openGraph: {
      type: 'website',
      locale: 'es_CL',
      siteName: `${site.nombre} · ${site.bajada}`,
      title: titulo,
      description: descripcion,
      url: ruta,
      images: [{ url: '/og.png', width: 1200, height: 630, alt: `${site.nombre} · ${site.bajada}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: descripcion,
      images: ['/og.png'],
    },
  };
}
