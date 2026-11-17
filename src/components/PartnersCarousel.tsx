'use client';

import Image from 'next/image';
import { useState } from 'react';

const inmobiliarias = [
  { nombre: 'Nollagam', logo: '/images/inmobiliarias/nollagam.jpg' },
  { nombre: 'Vimac', logo: '/images/inmobiliarias/vimac.png' },
  { nombre: 'Torina', logo: '/images/inmobiliarias/torina.png' },
  { nombre: 'Ingevec', logo: '/images/inmobiliarias/ingevec.png' },
  { nombre: 'Socovesa', logo: '/images/inmobiliarias/socovesa.png' },
  { nombre: 'RVC', logo: '/images/inmobiliarias/rvc.png' },
  { nombre: 'Exxacon', logo: '/images/inmobiliarias/exxacon.png' },
  { nombre: 'Activa', logo: '/images/inmobiliarias/activa.png' },
  { nombre: 'Leben', logo: '/images/inmobiliarias/leben.jpg' },
] as const;

function Logos({ repetidos = false }: { repetidos?: boolean }) {
  return (
    <ul className="partners__list" aria-hidden={repetidos ? true : undefined}>
      {inmobiliarias.map(({ nombre, logo }) => (
        <li className="partners__item" key={nombre}>
          <Image
            className="partners__logo"
            src={logo}
            alt={repetidos ? '' : `Logo de ${nombre}`}
            width={72}
            height={72}
            unoptimized
          />
          <span className="partners__name">{nombre}</span>
        </li>
      ))}
    </ul>
  );
}

export function PartnersCarousel() {
  const [pausado, setPausado] = useState(false);

  return (
    <div className="partners" aria-labelledby="partners-title">
      <div className="partners__header">
        <div>
          <span className="partners__eyebrow">Nuestra red de proyectos</span>
          <h2 className="partners__title" id="partners-title">
            Inmobiliarias con cuyos proyectos trabajamos
          </h2>
        </div>
        <button
          className="partners__control"
          type="button"
          aria-pressed={pausado}
          onClick={() => setPausado((valor) => !valor)}
        >
          {pausado ? 'Reanudar movimiento' : 'Pausar movimiento'}
        </button>
      </div>
      <div className="partners__viewport" data-paused={pausado} tabIndex={0} aria-label="Logos de inmobiliarias; desplaza para ver más">
        <div className="partners__track">
          <Logos />
          <Logos repetidos />
        </div>
      </div>
    </div>
  );
}
