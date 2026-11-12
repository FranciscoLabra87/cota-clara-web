import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Sin override de caché incremental: el sitio público es casi todo estático y
// el caché por defecto alcanza. Cuando las propiedades pasen a D1 (etapa 2)
// conviene revisar r2IncrementalCache, que necesita su propio bucket.
// `buildCommand` es lo que OpenNext corre para generar el .next antes de
// empaquetar el Worker. Por defecto sería `npm run build`, que en este repo ya
// es `opennextjs-cloudflare build`: se llamaría a sí mismo para siempre. Acá
// se apunta directo a Next para cortar esa vuelta.
export default {
  ...defineCloudflareConfig({}),
  buildCommand: 'next build',
};
