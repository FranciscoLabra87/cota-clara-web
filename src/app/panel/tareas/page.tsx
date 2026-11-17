import { TareasTablero, type TareaFila } from '@/components/TareasTablero';
import { tituloPropiedad } from '@/data/properties';
import { esAdmin } from '@/lib/auth';
import { exigirSesion } from '@/lib/guardias';
import { propiedadesDelPanel } from '@/lib/propiedades';
import { listarTareas, responsables } from '@/lib/tareas';
import { diaDeChile } from '@/lib/visitas';

export const dynamic = 'force-dynamic';

/** AAAA-MM-DD → DD-MM-AAAA, como se escribe acá. */
const fechaCorta = (iso: string) => iso.split('-').reverse().join('-');

export default async function TareasPage() {
  const sesion = await exigirSesion();
  const [tareas, usuarios, propiedades] = await Promise.all([listarTareas(), responsables(), propiedadesDelPanel()]);

  // Vencida se decide acá, con el día de Chile, para que no dependa de la
  // zona horaria del computador de quien mira.
  const hoy = diaDeChile();
  const filas: TareaFila[] = tareas.map((t) => ({
    ...t,
    vencida: t.estado !== 'hecha' && !!t.venceEn && t.venceEn < hoy,
    venceTexto: t.venceEn ? fechaCorta(t.venceEn) : null,
  }));

  return (
    <TareasTablero
      tareas={filas}
      usuarios={usuarios}
      propiedades={propiedades.map((p) => ({ id: p.id, nombre: tituloPropiedad(p) }))}
      usuarioId={sesion.usuario_id}
      esAdmin={esAdmin(sesion.rol)}
    />
  );
}
