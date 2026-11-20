import { errorJson } from '@/lib/auth';
import { normalizarAjustesFicha, type AjustesFichaComercial } from '@/lib/ficha-comercial-contenido';
import { generarFichaComercialPdf } from '@/lib/ficha-comercial-pdf';
import { cargarMapaFicha } from '@/lib/ficha-mapa';
import { cargarFotosPdf, ErrorRecursosPdf, MAX_FOTOS_COMERCIAL_PDF, seleccionarFotosPdf } from '@/lib/ficha-pdf-recursos';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';
import { propiedadPorId } from '@/lib/propiedades';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * GET descarga la ficha tal como está el aviso; POST acepta los ajustes del
 * panel (titular, bajada y destacados), que no se guardan en ninguna parte.
 */
async function responder(request: Request, params: Params['params'], cuerpo: unknown | undefined) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Propiedad no válida', 400);

  const propiedad = await propiedadPorId(id);
  if (!propiedad) return errorJson('No existe esa propiedad', 404);

  let ajustes: AjustesFichaComercial;
  let fotos: string | null;
  try {
    ajustes = normalizarAjustesFicha(cuerpo, propiedad);
    const pedidas = cuerpo && typeof cuerpo === 'object' && 'fotos' in cuerpo
      ? (cuerpo as { fotos: unknown }).fotos
      : undefined;
    if (pedidas === undefined) fotos = new URL(request.url).searchParams.get('fotos');
    else if (Array.isArray(pedidas)) fotos = pedidas.length ? pedidas.map(String).join(',') : 'ninguna';
    else return errorJson('Selecciona las fotos de la propiedad o elige generar sin fotos.', 400);
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : 'Revisa los datos de la ficha.', 400);
  }

  try {
    const urls = seleccionarFotosPdf(fotos, propiedad.imagenes ?? [], MAX_FOTOS_COMERCIAL_PDF);
    const imagenes = await cargarFotosPdf(urls);
    // El mapa es opcional por diseño: si las teselas no llegan, la ficha sale sin esa página.
    const mapa = ajustes.mapa ? await cargarMapaFicha(propiedad.latitud, propiedad.longitud) : null;
    const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeZone: 'America/Santiago' }).format(new Date());
    const pdf = await generarFichaComercialPdf(propiedad, { fecha, imagenes, ajustes, mapa });
    const slug = propiedad.slug.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 100) || 'propiedad';
    const nombre = `Ficha_Comercial_Cota_Clara_CC-${id}_${slug}.pdf`;

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
    console.error('[ficha-comercial-pdf] No se pudo generar el documento');
    return errorJson('No pudimos generar la ficha comercial. Intenta de nuevo o genera sin fotos.', 503);
  }
}

export async function GET(request: Request, { params }: Params) {
  return responder(request, params, undefined);
}

export async function POST(request: Request, { params }: Params) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return errorJson('No pudimos leer los datos de la ficha.', 400);
  }
  if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    return errorJson('No pudimos leer los datos de la ficha.', 400);
  }
  return responder(request, params, cuerpo);
}
