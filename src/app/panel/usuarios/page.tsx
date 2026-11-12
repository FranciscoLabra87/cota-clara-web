import { UsuariosPanel, type UsuarioFila } from '@/components/UsuariosPanel';
import { formatearRut, obtenerDB } from '@/lib/auth';
import { exigirAdmin } from '@/lib/guardias';

export const dynamic = 'force-dynamic';

type FilaCruda = Omit<UsuarioFila, 'rut'> & { rut_norm: string };

export default async function UsuariosPage() {
  const sesion = await exigirAdmin();
  const db = await obtenerDB();

  const { results } = await db
    .prepare(
      `SELECT id, rut_norm, nombre, email, rol, activo, password_temporal, ultimo_login
       FROM usuarios ORDER BY activo DESC, nombre`,
    )
    .all<FilaCruda>();

  const usuarios: UsuarioFila[] = results.map(({ rut_norm, ...resto }) => ({ ...resto, rut: formatearRut(rut_norm) }));

  return <UsuariosPanel usuarios={usuarios} yoId={sesion.usuario_id} />;
}
