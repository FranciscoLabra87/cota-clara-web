import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CrmTablero, type ActividadFila } from '@/components/CrmTablero';
import { segmentos, tituloPropiedad } from '@/data/properties';
import { esAdmin } from '@/lib/auth';
import { actividadesDe, interesadosDe, resumenes } from '@/lib/crm';
import { horaDeChile } from '@/lib/fecha';
import { exigirSesion } from '@/lib/guardias';
import { idDeRuta } from '@/lib/panel-api';
import { propiedadPorId } from '@/lib/propiedades';
import { listarTareas } from '@/lib/tareas';
import { visitasPorPropiedad } from '@/lib/visitas';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export default async function SeguimientoPage({ params }: Params) {
  const sesion = await exigirSesion();
  const id = idDeRuta((await params).id);
  if (!id) notFound();

  const propiedad = await propiedadPorId(id);
  if (!propiedad) notFound();

  const [interesados, actividades, resumen, visitas, tareas] = await Promise.all([
    interesadosDe(id),
    actividadesDe(id),
    resumenes(id),
    visitasPorPropiedad(),
    listarTareas({ propiedadId: id }),
  ]);

  const historial: ActividadFila[] = actividades.map(({ fecha, ...resto }) => ({ ...resto, cuando: horaDeChile(fecha) }));
  const datos = resumen.get(id);
  const ultimo = datos?.ultimo ? { ...datos.ultimo, cuando: horaDeChile(datos.ultimo.fecha) } : null;

  return (
    <>
      <Link className="panel__volver" href="/panel/crm">
        ← Volver al CRM
      </Link>
      <CrmTablero
        propiedad={{
          id,
          titulo: tituloPropiedad(propiedad),
          segmento: segmentos[propiedad.condicion].label,
          publicada: propiedad.estado === 'PUBLICADA',
          slug: propiedad.slug,
        }}
        numeros={{
          visitasWeb: visitas.get(id)?.total ?? 0,
          visitasSemana: visitas.get(id)?.semana ?? 0,
          interesados: datos?.interesados ?? 0,
          activos: datos?.activos ?? 0,
          llamadas: datos?.llamadas ?? 0,
          visitasFisicas: datos?.visitas ?? 0,
        }}
        ultimo={ultimo}
        interesados={interesados.map(({ creadoEn, ...resto }) => ({ ...resto, llego: horaDeChile(creadoEn) }))}
        actividades={historial}
        tareas={tareas
          .filter((t) => t.estado !== 'hecha' && t.interesadoId !== null)
          .map((t) => ({
            id: t.id,
            titulo: t.titulo,
            interesadoId: t.interesadoId!,
            responsableNombre: t.responsableNombre,
            venceTexto: t.venceEn ? t.venceEn.split('-').reverse().join('-') : null,
          }))}
        usuarioId={sesion.usuario_id}
        esAdmin={esAdmin(sesion.rol)}
      />
    </>
  );
}
