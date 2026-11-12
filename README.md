# Cota Clara · Sitio web

Sitio de Cota Clara, Patrimonio Inmobiliario: corretaje, tasaciones, asesoría y gestión de patrimonio.

Next.js 15 (App Router) + TypeScript. CSS propio con metodología **BEM** y layouts con **Flexbox**, sin frameworks de estilos.

## Cómo correrlo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start   # producción
```

Requiere Node 18.18 o superior.

## Páginas

| Ruta | Contenido |
| --- | --- |
| `/` | Portada: buscador, servicios, propiedades destacadas, informe de valor, tasación, proceso, comunas, preguntas y contacto |
| `/propiedades` | Listado con filtros (operación, tipo, comuna, dormitorios, precio y orden), sincronizados con la URL |
| `/propiedades/[slug]` | Ficha: galería con visor, características, planta, ubicación, simulador de dividendo y formulario de visita |
| `/servicios/[slug]` | Corretaje, tasaciones, asesoría y gestión patrimonial |
| `/contacto` | Formulario, canales y privacidad |

## Estructura

```
src/
  app/            páginas, layout, API de contacto, sitemap y robots
  components/     componentes React (Header, PropertyCard, Gallery, LeadForm…)
  data/           contenido: site.ts, properties.ts, services.ts
  lib/            formato de precios y filtros
  styles/
    tokens.css    colores, tipografías y espacios de la guía de identidad
    base.css      reset y utilidades mínimas
    blocks/       un archivo por bloque BEM
```

## BEM

- Bloque: `.property-card` · Elemento: `.property-card__price` · Modificador: `.badge--venta`.
- Selectores planos, sin anidar ni usar IDs. Cada bloque vive en `src/styles/blocks/<bloque>.css` y se importa en `src/app/globals.css`.
- Los valores salen de `tokens.css` (`--color-petroleo`, `--color-terracota`, `--ff-display`…).

## Identidad

- Azul petróleo `#0B2F4A`, terracota `#C65A32`, gris claro `#E6E6E6`, carbón `#222222`, blanco.
- Para botones con texto blanco se usa `--color-terracota-600` (`#B4502B`), un tono más profundo del terracota que cumple el contraste mínimo de accesibilidad (4,5:1).
- Montserrat (títulos y logotipo) y Source Sans 3 (textos), incluidas en `src/app/fonts` con licencia OFL.

## Antes de publicar

1. **Propiedades:** reemplaza los ejemplos de `src/data/properties.ts` por el inventario real.
2. **Fotos:** deja las fotos en `public/propiedades/` y agrégalas en `imagenes: ['/propiedades/mi-foto.jpg']`. Mientras no haya fotos, cada propiedad muestra una ilustración de marca.
3. **Formularios:** `src/app/api/contacto/route.ts` valida y registra las solicitudes, pero todavía no las envía. Conecta un servicio de correo (por ejemplo Resend) o tu CRM en el punto marcado.
4. **Datos de contacto y honorarios:** revisa `src/data/site.ts` y `src/data/services.ts`. Los honorarios son referenciales.
5. **Dominio:** actualiza `site.url` para que el sitemap y los metadatos apunten al dominio final.
