import { getCloudflareContext } from '@opennextjs/cloudflare';
import { atenderArchivo, type Entorno } from '@/lib/drive';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// En producción esta ruta la atiende worker.ts antes de llegar acá. Esta
// versión existe para `npm run dev`, que no pasa por worker.ts.
async function atender(request: Request, { params }: Params) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  return atenderArchivo(request, env as unknown as Entorno, { id: Number(id) });
}

export const GET = atender;
export const HEAD = atender;
