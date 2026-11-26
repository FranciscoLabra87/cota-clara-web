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
import { redireccionPublica, protegerHttps } from './src/lib/https';
import { atenderFotoOptimizada } from './src/lib/fotos-optimizadas';

// @ts-ignore: idem
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    const redireccion = redireccionPublica(request);
    if (redireccion) return redireccion;
    const responder = (respuesta: Response) => protegerHttps(request, respuesta);
    const imagen = await atenderFotoOptimizada(request, env);
    if (imagen) return responder(imagen);
    const pathname = new URL(request.url).pathname;
    const ruta = rutaDrive(pathname);
    if (ruta?.tipo === 'parte') return responder(await atenderParte(request, env as unknown as Entorno, ruta, request.body));
    if (ruta?.tipo === 'archivo') return responder(await atenderArchivo(request, env as unknown as Entorno, ruta));
    // Worker primero también para assets: HTTP no puede saltarse la redirección.
    // Los assets conocidos van directo a su binding, sin ejecutar el servidor Next.
    if (env.ASSETS && (pathname.startsWith('/_next/static/') || pathname.startsWith('/images/') || pathname === '/og.png')) {
      return responder(await env.ASSETS.fetch(request));
    }
    return responder(await nextjs.fetch(request, env, ctx));
  },
} satisfies ExportedHandler<CloudflareEnv>;
