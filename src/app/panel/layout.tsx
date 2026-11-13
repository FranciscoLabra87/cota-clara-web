import type { Metadata } from 'next';
import Link from 'next/link';
import { CerrarSesion } from '@/components/CerrarSesion';
import { esAdmin } from '@/lib/auth';
import { exigirSesionBasica } from '@/lib/guardias';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Panel',
  robots: { index: false, follow: false },
};

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // Guardia de base. Cada página vuelve a pedir lo suyo con exigirSesion o
  // exigirAdmin: la autorización no se delega en un solo punto.
  const sesion = await exigirSesionBasica();
  const mostrarUsuarios = esAdmin(sesion.rol) && !sesion.password_temporal;

  return (
    <div className="panel">
      <div className="panel__bar">
        <div className="panel__bar-inner container">
          <div className="panel__identidad">
            <p className="panel__eyebrow">Panel interno</p>
            <p className="panel__usuario">
              {sesion.nombre} · {sesion.rol === 'ADMIN' ? 'Administrador' : 'Editor'}
            </p>
          </div>
          <nav className="panel__nav" aria-label="Panel">
            <Link className="panel__nav-link" href="/panel">
              Inicio
            </Link>
            {sesion.password_temporal ? null : (
              <>
                <Link className="panel__nav-link" href="/panel/propiedades">
                  Propiedades
                </Link>
                <Link className="panel__nav-link" href="/panel/solicitudes">
                  Solicitudes
                </Link>
              </>
            )}
            {mostrarUsuarios ? (
              <Link className="panel__nav-link" href="/panel/usuarios">
                Usuarios
              </Link>
            ) : null}
            <CerrarSesion />
          </nav>
        </div>
      </div>
      <div className="panel__body container">{children}</div>
    </div>
  );
}
