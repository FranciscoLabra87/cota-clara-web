import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Sin override de caché incremental: el sitio público es casi todo estático y
// el caché por defecto alcanza. Cuando las propiedades pasen a D1 (etapa 2)
// conviene revisar r2IncrementalCache, que necesita su propio bucket.
export default defineCloudflareConfig({});
