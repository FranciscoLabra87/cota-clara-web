import { PropiedadesPanel } from '@/components/PropiedadesPanel';
import { exigirSesion } from '@/lib/guardias';
import { propiedadesDelPanel } from '@/lib/propiedades';
import { visitasPorPropiedad } from '@/lib/visitas';

export const dynamic = 'force-dynamic';

export default async function PanelPropiedadesPage() {
  await exigirSesion();
  const [propiedades, visitas] = await Promise.all([propiedadesDelPanel(), visitasPorPropiedad()]);
  return <PropiedadesPanel propiedades={propiedades} visitas={Object.fromEntries(visitas)} />;
}
