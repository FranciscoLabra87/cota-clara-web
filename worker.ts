// Punto de entrada del Worker en producción (`main` en wrangler.jsonc).
//
// Atiende dos rutas del Drive antes de que el pedido llegue a Next: la subida
// de cada parte y la descarga de archivos. Las dos mueven muchos bytes, y acá
// se pasan directo entre el pedido y R2 sin copiarlos en JavaScript. Por Next
// cada byte pasaría por su capa de compatibilidad con Node y gastaría CPU; en
// el plan gratis de Workers cada pedido tiene 10 ms.
//
// Todo lo demás sigue de largo al Worker que genera OpenNext. Esas mismas dos
// rutas existen también en Next (src/app/drive/…), para que funcionen en
// `npm run dev`, que no pasa por este archivo.

// @ts-ignore: lo genera `opennextjs-cloudflare build` en .open-next/
import { default as nextjs } from './.open-next/worker.js';
import { atenderArchivo, atenderParte, rutaDrive, type Entorno } from './src/lib/drive';

// @ts-ignore: idem
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    const ruta = rutaDrive(new URL(request.url).pathname);
    if (ruta?.tipo === 'parte') return atenderParte(request, env as unknown as Entorno, ruta, request.body);
    if (ruta?.tipo === 'archivo') return atenderArchivo(request, env as unknown as Entorno, ruta);
    return nextjs.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<CloudflareEnv>;
