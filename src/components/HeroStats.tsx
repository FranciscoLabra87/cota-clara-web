'use client';

import { useEffect, useRef } from 'react';

// Las cifras de trayectoria (10+ y 150) fueron proporcionadas por el equipo.
// La cobertura de tres regiones ya está declarada en la portada.
const indicadores = [
  {
    valor: 10,
    sufijo: '+',
    etiqueta: 'años de experiencia del equipo',
    lectura: 'Más de 10 años de experiencia del equipo',
  },
  {
    valor: 150,
    sufijo: '',
    etiqueta: 'proyectos acompañados',
    lectura: '150 proyectos acompañados',
  },
  {
    valor: 3,
    sufijo: '',
    etiqueta: 'regiones de cobertura',
    lectura: 'Cobertura en 3 regiones',
  },
];

export function HeroStats() {
  const seccion = useRef<HTMLElement>(null);

  useEffect(() => {
    const elemento = seccion.current;
    if (!elemento || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        observador.disconnect();

        const numeros = elemento.querySelectorAll<HTMLElement>('[data-count]');
        const inicio = performance.now();
        const duracion = 1000;

        const animar = (ahora: number) => {
          const progreso = Math.min((ahora - inicio) / duracion, 1);
          const avance = 1 - (1 - progreso) ** 3;

          numeros.forEach((numero) => {
            const meta = Number(numero.dataset.count);
            numero.textContent = `${Math.round(meta * avance).toLocaleString('es-CL')}${numero.dataset.suffix ?? ''}`;
          });

          if (progreso < 1) frame = requestAnimationFrame(animar);
        };

        frame = requestAnimationFrame(animar);
      },
      { threshold: 0.35 },
    );

    observador.observe(elemento);
    return () => {
      observador.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="hero__stats" aria-labelledby="hero-stats-titulo" ref={seccion}>
      <h2 className="hero__stats-heading" id="hero-stats-titulo">Experiencia y alcance</h2>
      <ul className="hero__stats-list">
        {indicadores.map(({ valor, sufijo, etiqueta, lectura }) => (
          <li className="hero__stat" key={etiqueta}>
            <span className="hero__stat-number" data-count={valor} data-suffix={sufijo} aria-hidden="true">
              {valor}{sufijo}
            </span>
            <span className="hero__stat-label" aria-hidden="true">{etiqueta}</span>
            <span className="visually-hidden">{lectura}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
