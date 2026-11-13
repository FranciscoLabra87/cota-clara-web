import { SolicitudesPanel, type SolicitudFila } from '@/components/SolicitudesPanel';
import { exigirSesion } from '@/lib/guardias';
import { solicitudesRecientes } from '@/lib/solicitudes';

export const dynamic = 'force-dynamic';

const FORMATO = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' });

// SQLite entrega la hora en UTC y sin zona ('2026-11-12 23:40:05'). Se pasa a
// hora de Chile acá, en el servidor: si la armara el navegador, dependería de
// la zona del computador de quien mira y el HTML del servidor no calzaría.
const horaDeChile = (utc: string) => FORMATO.format(new Date(`${utc.replace(' ', 'T')}Z`));

export default async function SolicitudesPage() {
  await exigirSesion();

  const solicitudes: SolicitudFila[] = (await solicitudesRecientes()).map(({ creadaEn, ...resto }) => ({
    ...resto,
    llego: horaDeChile(creadaEn),
  }));

  return <SolicitudesPanel solicitudes={solicitudes} />;
}
