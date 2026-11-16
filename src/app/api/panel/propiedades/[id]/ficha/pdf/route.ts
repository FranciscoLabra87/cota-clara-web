import { errorJson } from '@/lib/auth';
import { fichaDe } from '@/lib/ficha-tecnica';
import { generarFichaPdf } from '@/lib/ficha-pdf';
import { cargarFotosPdf, ErrorRecursosPdf, seleccionarFotosPdf } from '@/lib/ficha-pdf-recursos';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';
import { propiedadPorId } from '@/lib/propiedades';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;
  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Propiedad no válida', 400);

  const url = new URL(request.url);
  const version = url.searchParams.get('version') ?? 'cliente';
  if (!['cliente', 'interna'].includes(version)) return errorJson('Elige la versión para cliente o de uso interno.', 400);
  const propiedad = await propiedadPorId(id);
  if (!propiedad) return errorJson('No existe esa propiedad', 404);

  try {
    const seleccion = seleccionarFotosPdf(url.searchParams.get('fotos'), propiedad.imagenes ?? []);
    const [antecedentes, imagenes] = await Promise.all([fichaDe(id), cargarFotosPdf(seleccion)]);
    const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeZone: 'America/Santiago' }).format(new Date());
    const pdf = await generarFichaPdf(propiedad, antecedentes, { interna: version === 'interna', fecha, imagenes });
    const slug = propiedad.slug.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 100) || 'propiedad';
    const nombre = `Ficha_Tecnica_Cota_Clara_CC-${id}_${slug}_${version}.pdf`;
    return new Response(new Uint8Array(pdf).buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof ErrorRecursosPdf) return errorJson(error.message, error.status);
    console.error('[ficha-pdf] No se pudo generar el documento');
    return errorJson('No pudimos generar el PDF. Intenta de nuevo o genera la ficha sin fotos.', 503);
  }
}
