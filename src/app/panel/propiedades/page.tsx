import { PropiedadesPanel } from '@/components/PropiedadesPanel';
import { exigirSesion } from '@/lib/guardias';
import { propiedadesDelPanel } from '@/lib/propiedades';

export const dynamic = 'force-dynamic';

export default async function PanelPropiedadesPage() {
  await exigirSesion();
  const propiedades = await propiedadesDelPanel();
  return <PropiedadesPanel propiedades={propiedades} />;
}
