import Image from 'next/image';
import { Illustration, type IllustrationVariant } from './Illustration';
import type { Propiedad, TipoPropiedad } from '@/data/properties';

export const varianteTipo = (tipo: TipoPropiedad): IllustrationVariant =>
  tipo === 'casa' ? 'casa' : tipo === 'oficina' ? 'oficina' : 'edificio';

type Props = {
  propiedad: Propiedad;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

/** Foto real si existe; si no, la ilustración de marca de la propiedad. */
export function PropertyMedia({ propiedad, className, sizes = '(max-width: 700px) 100vw, 33vw', priority = false }: Props) {
  const foto = propiedad.imagenes?.[0];
  if (foto) {
    return <Image src={foto} alt="" fill sizes={sizes} className={className} priority={priority} />;
  }
  return (
    <Illustration
      variant={varianteTipo(propiedad.tipo)}
      seed={propiedad.ilustracion.seed}
      tono={propiedad.ilustracion.tono}
      className={className}
    />
  );
}
