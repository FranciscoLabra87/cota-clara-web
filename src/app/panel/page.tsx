import Link from 'next/link';
import { esAdmin, formatearRut } from '@/lib/auth';
import { exigirSesion } from '@/lib/guardias';

export const dynamic = 'force-dynamic';

export default async function PanelPage() {
  const sesion = await exigirSesion();
  const primerNombre = sesion.nombre.trim().split(/\s+/)[0];

  return (
    <>
      <h1 className="panel__title">Hola, {primerNombre}</h1>
      <p className="panel__intro">
        Entraste como <strong>{formatearRut(sesion.rut_norm)}</strong>, con rol{' '}
        {sesion.rol === 'ADMIN' ? 'de administrador' : 'de editor'}.
      </p>

      <div className="panel__grid">
        <article className="panel__card">
          <h2 className="panel__card-title">Propiedades</h2>
          <p className="panel__card-text">
            Carga, edita y publica propiedades con sus fotos. Lo que publiques aparece en el sitio al tiro, sin esperar un
            despliegue.
          </p>
          <Link className="button button--primary button--sm" href="/panel/propiedades">
            Gestionar propiedades
          </Link>
        </article>

        <article className="panel__card">
          <h2 className="panel__card-title">Solicitudes</h2>
          <p className="panel__card-text">
            Lo que llega por los formularios del sitio: consultas, tasaciones y visitas. Quedan guardadas aunque el aviso por correo no
            salga.
          </p>
          <Link className="button button--primary button--sm" href="/panel/solicitudes">
            Ver solicitudes
          </Link>
        </article>

        {esAdmin(sesion.rol) ? (
          <article className="panel__card">
            <h2 className="panel__card-title">Usuarios</h2>
            <p className="panel__card-text">
              Crea las cuentas del equipo, resetea contraseñas y desactiva accesos. Cada cuenta nueva parte con una clave
              temporal que su dueño cambia al entrar.
            </p>
            <Link className="button button--primary button--sm" href="/panel/usuarios">
              Gestionar usuarios
            </Link>
          </article>
        ) : null}

        <article className="panel__card">
          <h2 className="panel__card-title">Tu contraseña</h2>
          <p className="panel__card-text">
            Cámbiala cuando quieras. Al cambiarla se cierran todas las sesiones abiertas con la anterior.
          </p>
          <Link className="button button--outline button--sm" href="/panel/clave">
            Cambiar contraseña
          </Link>
        </article>
      </div>
    </>
  );
}
