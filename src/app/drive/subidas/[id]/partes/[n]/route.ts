import { getCloudflareContext } from '@opennextjs/cloudflare';
import { atenderParte, type Entorno } from '@/lib/drive';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; n: string }> };

// En producción esta ruta la atiende worker.ts antes de llegar acá, pasando
// el cuerpo directo a R2. Esta versión existe para `npm run dev`, que no pasa
// por worker.ts: lee la parte entera en memoria, que en local da igual.
export async function PUT(request: Request, { params }: Params) {
  const { id, n } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const cuerpo = await request.arrayBuffer();
  return atenderParte(request, env as unknown as Entorno, { id: Number(id), n: Number(n) }, cuerpo);
}
