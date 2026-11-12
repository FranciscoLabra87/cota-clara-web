'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Illustration, type IllustrationVariant, type Tono } from './Illustration';

export type GalleryItem =
  | { kind: 'foto'; src: string; label: string }
  | {
      kind: 'ilustracion';
      label: string;
      variant: IllustrationVariant;
      seed?: number;
      tono?: Tono;
      dormitorios?: number;
      superficie?: number;
      planta?: 'vivienda' | 'oficina';
      etiqueta?: string;
    };

function Media({ item, className, sizes }: { item: GalleryItem; className: string; sizes: string }) {
  if (item.kind === 'foto') return <Image src={item.src} alt={item.label} fill sizes={sizes} className={className} />;
  const { kind, label, ...props } = item;
  void kind;
  return <Illustration {...props} label={label} className={className} />;
}

export function Gallery({ items }: { items: GalleryItem[] }) {
  const [actual, setActual] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const total = items.length;
  const ir = (delta: number) => setActual((i) => (i + delta + total) % total);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onKey = (e: KeyboardEvent) => {
      if (!d.open) return;
      if (e.key === 'ArrowRight') ir(1);
      if (e.key === 'ArrowLeft') ir(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const item = items[actual];

  return (
    <div className="gallery">
      <div className="gallery__stage">
        <Media item={item} className="gallery__media" sizes="(max-width: 900px) 100vw, 66vw" />
        <button type="button" className="gallery__nav gallery__nav--prev" onClick={() => ir(-1)} aria-label="Imagen anterior">
          <Icon name="chevronLeft" />
        </button>
        <button type="button" className="gallery__nav gallery__nav--next" onClick={() => ir(1)} aria-label="Imagen siguiente">
          <Icon name="chevronRight" />
        </button>
        <span className="gallery__counter" aria-live="polite">
          {actual + 1} / {total} · {item.label}
        </span>
        <button type="button" className="gallery__expand" onClick={() => dialog.current?.showModal()} aria-label="Ver imagen en grande">
          <Icon name="expand" />
        </button>
      </div>

      <div className="gallery__thumbs">
        {items.map((it, i) => (
          <button
            key={it.label}
            type="button"
            className={`gallery__thumb${i === actual ? ' gallery__thumb--active' : ''}`}
            onClick={() => setActual(i)}
            aria-label={`Ver ${it.label}`}
            aria-pressed={i === actual}
          >
            <Media item={it} className="gallery__thumb-media" sizes="160px" />
          </button>
        ))}
      </div>

      <dialog
        ref={dialog}
        className="gallery__dialog"
        aria-label={item.label}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="gallery__dialog-frame">
          <Media item={item} className="gallery__dialog-media" sizes="100vw" />
          <button type="button" className="gallery__close" onClick={() => dialog.current?.close()} aria-label="Cerrar">
            <Icon name="close" />
          </button>
          <button type="button" className="gallery__nav gallery__nav--prev" onClick={() => ir(-1)} aria-label="Imagen anterior">
            <Icon name="chevronLeft" />
          </button>
          <button type="button" className="gallery__nav gallery__nav--next" onClick={() => ir(1)} aria-label="Imagen siguiente">
            <Icon name="chevronRight" />
          </button>
          <span className="gallery__counter">
            {actual + 1} / {total} · {item.label}
          </span>
        </div>
      </dialog>
    </div>
  );
}
