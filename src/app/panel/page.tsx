import Link from 'next/link';
import { CapacidadPanel } from '@/components/CapacidadPanel';
import { esAdmin, formatearRut } from '@/lib/auth';
import { medirCapacidad } from '@/lib/capacidad';
import { exigirSesion } from '@/lib/guardias';
import { solicitudesSinResponder } from '@/lib/solicitudes';
import { pendientesDe } from '@/lib/tareas';

export const dynamic = 'force-dynamic';

export default async function PanelPage() {
  const sesion = await exigirSesion();
  const primerNombre = sesion.nombre.trim().split(/\s+/)[0];
  const pendientes = await pendientesDe(sesion.usuario_id);
  const sinResponder = await solicitudesSinResponder();
  const capacidad = esAdmin(sesion.rol) ? await medirCapacidad() : null;

  return (
    <>
      <h1 className="panel__title">Hola, {primerNombre}</h1>
      <p className="panel__intro">
        Entraste como <strong>{formatearRut(sesion.rut_norm)}</strong>, con rol{' '}
        {sesion.rol === 'ADMIN' ? 'de administrador' : 'de editor'}.
      </p>

      {sinResponder > 0 ? (
        <p className="panel__pendientes" role="status">
          <span className="panel__contador panel__contador--grande">{sinResponder}</span>
          <span>
            {sinResponder === 1 ? 'Hay 1 solicitud del sitio sin responder.' : `Hay ${sinResponder} solicitudes del sitio sin responder.`}
          </span>
          <Link className="button button--primary button--sm" href="/panel/solicitudes">
            Ver solicitudes
          </Link>
        </p>
      ) : null}

      <div className="panel__grid">
        <article className="panel__card">
          <h2 className="panel__card-title">Drive</h2>
          <p className="panel__card-text">
            Fotos, videos y documentos del equipo. Cada uno sube a su carpeta, de a muchos archivos a la vez, y todos ven todas las
            carpetas.
          </p>
          <Link className="button button--primary button--sm" href="/panel/drive">
            Abrir el Drive
          </Link>
        </article>
        <article className="panel__card">
          <h2 className="panel__card-title">Fichas de propiedades</h2>
          <p className="panel__card-text">Crea una ficha comercial visual con los datos del aviso o una ficha técnico-legal con antecedentes detallados. Elige las fotos y descarga el PDF.</p>
          <Link className="button button--primary button--sm" href="/panel/fichas">Generar fichas</Link>
        </article>
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
          <h2 className="panel__card-title">Proyectos y stock</h2>
          <p className="panel__card-text">
            Las unidades de cada proyecto de inversión: tipologías, precios y disponibilidad. Se cargan pegando la planilla de la
            inmobiliaria, y lo disponible fija el «desde» del aviso.
          </p>
          <Link className="button button--primary button--sm" href="/panel/proyectos">
            Ver proyectos
          </Link>
        </article>

        <article className={`panel__card${pendientes.vencidas ? ' panel__card--pendiente' : ''}`}>
          <h2 className="panel__card-title">Tareas</h2>
          <p className="panel__card-text">
            {pendientes.abiertas === 0
              ? 'No tienes tareas pendientes.'
              : `Tienes ${pendientes.abiertas} ${pendientes.abiertas === 1 ? 'tarea pendiente' : 'tareas pendientes'}${
                  pendientes.vencidas ? `, ${pendientes.vencidas} ${pendientes.vencidas === 1 ? 'vencida' : 'vencidas'}` : ''
                }.`}
          </p>
          <Link className="button button--primary button--sm" href="/panel/tareas">
            Ver tareas
          </Link>
        </article>

        <article className="panel__card">
          <h2 className="panel__card-title">CRM</h2>
          <p className="panel__card-text">
            Qué pasa con cada propiedad: sus interesados en un tablero por etapas, las llamadas, las visitas físicas y lo que dijo
            cada cliente.
          </p>
          <Link className="button button--primary button--sm" href="/panel/crm">
            Abrir el CRM
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
      {capacidad ? <CapacidadPanel datos={capacidad} /> : null}
    </>
  );
}
