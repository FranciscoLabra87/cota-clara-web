import { getCloudflareContext } from '@opennextjs/cloudflare';
import { DriveExplorer, type CarpetaVista } from '@/components/DriveExplorer';
import { EXTENSIONES, leerDrive, MAX_ARCHIVO, type Entorno } from '@/lib/drive';
import { exigirSesion } from '@/lib/guardias';

export const dynamic = 'force-dynamic';

const FORMATO = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' });

// SQLite entrega la hora en UTC y sin zona. Se pasa a hora de Chile en el
// servidor, para que no dependa del computador de quien mira.
const horaDeChile = (utc: string) => FORMATO.format(new Date(`${utc.replace(' ', 'T')}Z`));

export default async function DrivePage() {
  const sesion = await exigirSesion();
  const { env } = await getCloudflareContext({ async: true });
  const drive = await leerDrive(env as unknown as Entorno);

  const carpetas: CarpetaVista[] = drive.carpetas.map((c) => ({
    ...c,
    archivos: c.archivos.map(({ creadoEn, ...a }) => ({ ...a, fecha: horaDeChile(creadoEn) })),
  }));

  return (
    <DriveExplorer
      carpetas={carpetas}
      usado={drive.usado}
      cuota={drive.cuota}
      yo={{ id: sesion.usuario_id, admin: sesion.rol === 'ADMIN' }}
      extensiones={EXTENSIONES}
      maxArchivo={MAX_ARCHIVO}
    />
  );
}
