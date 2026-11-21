import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { analizarUnidades, ErrorImportacion } from '@/lib/importar-unidades';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';
import { aplicarImportacion, ErrorUnidad, planearImportacion } from '@/lib/unidades';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Una planilla de 2.000 unidades pegada como texto son unos 200 KB. El tope
// está para que nadie mande un archivo entero por este campo.
const MAX_TEXTO = 2_000_000;

/**
 * Carga el stock desde la planilla de la inmobiliaria. Sin `confirmar` solo
 * compara y devuelve qué cambiaría: la planilla llega sucia siempre, y
 * aplicarla a ciegas pisa precios y estados sin que nadie lo vea.
 */
export async function POST(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Propiedad no válida', 400);

  const body = (await request.json().catch(() => null)) as
    | { texto?: unknown; reemplazar?: unknown; confirmar?: unknown }
    | null;
  if (typeof body?.texto !== 'string' || !body.texto.trim()) return errorJson('Pega la planilla con el stock');
  if (body.texto.length > MAX_TEXTO) return errorJson('La planilla es demasiado grande. Cárgala por partes.', 413);

  const reemplazar = body.reemplazar === true;

  let analisis;
  try {
    analisis = analizarUnidades(body.texto);
  } catch (e) {
    if (e instanceof ErrorImportacion) return errorJson(e.message, 422);
    throw e;
  }

  try {
    if (body.confirmar !== true) {
      const plan = await planearImportacion(id, analisis.filas);
      return json({
        ok: true,
        confirmado: false,
        columnas: analisis.columnas,
        errores: analisis.errores,
        tipologiasNuevas: plan.tipologiasNuevas,
        iguales: plan.iguales,
        nuevas: plan.nuevas.map((f) => ({ numero: f.numero, precioUF: f.precioUF, estado: f.estado, tipologia: f.tipologia })),
        cambian: plan.cambian.map(({ fila, antes }) => ({
          numero: fila.numero,
          antes: { precioUF: antes.precioUF, estado: antes.estado },
          ahora: { precioUF: fila.precioUF, estado: fila.estado },
        })),
        sobran: plan.sobran.map((u) => u.numero),
      });
    }

    const resultado = await aplicarImportacion(id, analisis.filas, reemplazar);
    await registrar('UNIDADES_IMPORTADAS', {
      usuarioId: acceso.sesion.usuario_id,
      detalle: { propiedad_id: id, ...resultado, reemplazar },
      ip: ipDe(request),
    });
    return json({ ok: true, confirmado: true, errores: analisis.errores, ...resultado });
  } catch (e) {
    if (e instanceof ErrorUnidad) return errorJson(e.message, e.status);
    throw e;
  }
}
