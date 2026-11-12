import { CambiarClaveForm } from '@/components/CambiarClaveForm';
import { exigirSesionBasica } from '@/lib/guardias';

export const dynamic = 'force-dynamic';

export default async function CambiarClavePage() {
  // Esta es la única página del panel que se alcanza con la clave temporal
  // todavía puesta: es justamente adonde manda el guardia.
  const sesion = await exigirSesionBasica();
  const obligatorio = !!sesion.password_temporal;

  return (
    <div className="panel__estrecho">
      <h1 className="panel__title">{obligatorio ? 'Cambia tu contraseña temporal' : 'Cambiar contraseña'}</h1>
      <p className="panel__intro">
        {obligatorio
          ? 'La clave con la que entraste es de un solo uso. Elige una propia para seguir.'
          : 'Al guardar se cierran todas las sesiones abiertas con la contraseña anterior.'}
      </p>
      <CambiarClaveForm obligatorio={obligatorio} />
    </div>
  );
}
