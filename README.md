# Cota Clara · Sitio web

Sitio de Cota Clara, Patrimonio Inmobiliario: corretaje, tasaciones, asesoría y gestión de patrimonio.

Next.js 16 (App Router) + TypeScript, Cloudflare D1 para el inventario y R2 para las fotos. CSS propio con metodología **BEM** y layouts con **Flexbox**, sin frameworks de estilos.

## Cómo correrlo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start   # producción
```

Requiere Node 20.9 o superior.

## Páginas

| Ruta | Contenido |
| --- | --- |
| `/` | Portada: buscador, servicios, propiedades destacadas, informe de valor, tasación, proceso, comunas, preguntas y contacto |
| `/propiedades` | Listado con filtros (operación, tipo, comuna, dormitorios, precio y orden), sincronizados con la URL |
| `/propiedades/[slug]` | Ficha: galería con visor, características, ubicación, simulador de dividendo para ventas en UF y formulario de visita |
| `/servicios/[slug]` | Corretaje, tasaciones, asesoría y gestión patrimonial |
| `/contacto` | Formulario, canales y privacidad |

## Estructura

```
src/
  app/            páginas, layout, API de contacto, sitemap y robots
  components/     componentes React (Header, PropertyCard, Gallery, LeadForm…)
  data/           contenido de marca, tipos y servicios
  lib/            consultas a D1, fotos R2, formato de precios y filtros
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

## Inventario importado

El 12 de noviembre de 2026 se capturaron 20 avisos públicos de [Corredora Palma Fuentes](https://www.corredorapalmafuentes.cl/): 17 ventas y 3 arriendos. El origen verificable está en `db/palma-fuentes-source.json`; `db/import-palma-fuentes-images.json` registra las 348 fotos de sus galerías, sus URL y hashes. El SQL de importación se genera con `python scripts/generar-import-palma-fuentes.py --verify-images` cuando las fotos descargadas están en `.wrangler/state/palma-fuentes/`.

Para una base nueva, ejecuta `npm run db:local-schema` o `npm run db:schema`. En una base anterior, aplica una vez `db/migrations/20261112_titulo.sql`. Después de subir las fotos al bucket R2 `cota-clara-fotos` con las claves del manifiesto, ejecuta `npm run db:local-seed` o `npm run db:seed`. La importación elimina los ocho avisos ficticios iniciales, es repetible y conserva los cambios posteriores de las fichas importadas.

Las direcciones del origen están truncadas; se publica la comuna sin inventar un sector. El aviso 202039 mezcla Valparaíso en el título y descripción con Concón en el texto de dirección. El proyecto 201760 ofrece varias tipologías y no tiene un programa único; los campos ausentes quedan sin mostrar. Verifica la vigencia y disponibilidad de cada aviso antes de operar con clientes.

Antes de usar el sitio para captar solicitudes, revisa el contacto y los honorarios en `src/data/site.ts` y `src/data/services.ts`, configura los secretos `RESEND_API_KEY` y `LEADS_FROM` para el envío de formularios y activa el dominio final. El valor actual de `site.url` apunta a `www.cotaclara.cl`.

## Privacidad y publicación

`/privacidad`, `/terminos` y `/cookies` describen el tratamiento actual y enlazan las preferencias. Revisar los datos del responsable si la marca opera con otra razón social. El banner recuerda aceptar o rechazar la analítica durante 180 días; rechazar no impide consultar ni enviar formularios. La cookie del panel es necesaria para iniciar sesión.

Cloudflare Web Analytics conserva la medición sin cookies que ya está activa. Google Analytics 4 es opcional y viene desactivado. Para activarlo:

1. Crear o elegir un flujo web en la propiedad de GA4 y **desactivar Medición mejorada** en ese flujo. Evita eventos automáticos, vistas duplicadas y la captura de rutas internas o parámetros que el sitio no envía.
2. Configurar `NEXT_PUBLIC_GA4_ID=G-…` y `NEXT_PUBLIC_GA4_MANUAL_EVENTS=1` en el entorno **de construcción**, y volver a construir. Son opciones públicas, no claves secretas. Sin ambas, no se carga el script de Google.
3. Aceptar la analítica en un navegador de prueba y comprobar `page_view`, `contact_click` y `generate_lead`. El último sólo sale después de una solicitud aceptada. El sitio excluye el acceso, el panel, el Drive y la API; no envía nombres, correos, mensajes, consultas de la URL ni fragmentos. Rechazar o retirar la elección desactiva GA4 y borra las cookies `_ga*` del dominio que puede eliminar el navegador.

El Worker redirige con 308 el dominio público a `https://www.cotaclara.cl`, conservando ruta, consulta y método. `assets.run_worker_first` hace que también se aplique a los archivos estáticos; estos van directamente a ASSETS tras el control. Localhost y las direcciones de previsualización conservan su protocolo. No hace falta un proxy de Next.

Las fotografías de R2 usan tamaños adaptados y AVIF/WebP con el binding `IMAGES`. El Worker atiende esas optimizaciones desde R2 porque las rutas `/fotos/…` no son assets estáticos. Si el optimizador no está disponible se entrega el original con caché breve, sin ocultar la fotografía. Las imágenes originales y los documentos privados no se modifican.

Los secretos de Resend, SMTP y Turnstile permanecen en el servidor. `.env.example` sólo contiene nombres y ejemplos; los archivos `.env*` y `.dev.vars*` locales se excluyen de Git. El identificador de GA4 no reemplaza las credenciales de correo ni verifica la entrega real de mensajes.
