# Cota Clara · sitio web

Sitio de **Cota Clara** (bajada: Patrimonio Inmobiliario), firma de corretaje, tasaciones, asesoría y gestión patrimonial en Santiago de Chile. Lema: "El valor de saber."

## Cómo trabajar en este repo

- Responde en español (Chile).
- Sé directo y eficiente: cambios chicos e incrementales, sin documentación ni refactors que no se pidan. Pregunta antes de cambios grandes de estructura o diseño.
- Antes de cada commit, `npm run build` debe pasar.
- Commits en español sobre `main`, salvo que se pida una rama.

## Estado

- Repo: https://github.com/FranciscoLabra87/cota-clara-web (rama `main`). Carpeta local: `C:\Users\franc\dev\cota-clara-web`.
- El sitio completo ya está commiteado y pusheado a `main`.

## Stack y comandos

- Next.js 16 (App Router), React 19 y TypeScript. Sin Tailwind ni CSS-in-JS: CSS plano con BEM.
- Se despliega en **Cloudflare Workers** con `@opennextjs/cloudflare`. Bindings en `wrangler.jsonc`: `DB` (D1), `FOTOS` (R2) e `IMAGES`.
- En vivo en `https://cota-clara-web.franciscolabra87.workers.dev`. El dominio `cotaclara.cl` todavía no apunta al Worker.
- Comandos: `npm install` · `npm run dev` (http://localhost:3000) · `npm run build` · `npm start`.
- **`npm run build` es `opennextjs-cloudflare build`**, no `next build`: compila Next y empaqueta el Worker en `.open-next/`, que es lo que se despliega. Tarda más, pero es lo que sale al aire. Para una revisión rápida de tipos y compilación está `npm run build:next`.
- Por eso `open-next.config.ts` fija `buildCommand: 'next build'`. Si no, OpenNext correría `npm run build`, que ahora es él mismo, y se llamaría en círculo.
- Base local: `npm run db:local-schema` la crea, `npm run db:local-consulta -- "SELECT ..."` la consulta. `next dev` la monta sola desde `.wrangler/state`.
- `npm run preview` compila el Worker y lo corre en workerd, el runtime real. La documentación de OpenNext dice que Windows no está soportado, pero acá funciona; si algún día se rompe, la salida es WSL.
- **El deploy lo hace Cloudflare Workers Builds**, conectado al repo desde el panel de Cloudflare: despliega en cada push a `main`. Funciona con los comandos que Cloudflare trae por defecto (`npm run build` y `npx wrangler deploy`) justamente porque `npm run build` arma el Worker; no hay que configurar nada en el panel. El deploy busca `.open-next/.build/open-next.config.edge.mjs`: si ese archivo no está, responde «Could not find compiled Open Next config».
- **El botón Retry del panel reconstruye el mismo commit de esa corrida, no el último.** Si el arreglo está en un commit posterior, Retry lo vuelve a fallar igual. Para probar un arreglo hay que pushear.
- GitHub Actions (`.github/workflows/ci.yml`) **no despliega**: corre las pruebas y el build como control. Cloudflare no lo espera, así que una prueba caída se ve en GitHub pero no frena el deploy; para que lo frenara habría que correr `npm test` también en el build command de Cloudflare.
- El Worker pesa ~1,2 MiB comprimido (`npx wrangler deploy --dry-run` lo informa); el límite del plan gratis es 3 MiB.
- Turbopack es el bundler por defecto en `dev` y `build`; no hace falta `--turbopack`.
- En rutas dinámicas, `params` es una Promise: `const { slug } = await params`.
- Alias `@/*` → `src/*`. `next build` no corre lint (en Next 16 `next lint` y la opción `eslint` del config ya no existen).

## Marca

| Uso | Color |
| --- | --- |
| Azul Petróleo (principal) | `#0B2F4A` |
| Terracota (acento) | `#C65A32` |
| Terracota para botones con texto blanco (contraste 5.1:1) | `#B4502B` |
| Gris Claro | `#E6E6E6` |
| Carbón (texto) | `#222222` |
| Blanco | `#FFFFFF` |

- Tipografías locales en `src/app/fonts` (next/font/local). Montserrat 500/600/700 para títulos y logo; Source Sans 3 400/400 itálica/600 para texto. Variables `--font-montserrat` y `--font-source-sans`.
- Concepto: "Cota Clara es una firma inmobiliaria que combina precisión técnica, transparencia y experiencia para proteger y potenciar tu patrimonio."
- Logo en `src/components/Logo.tsx`: SVG con una C, una cruz de cota y un cuadrado terracota. Variantes `color` y `negativo`.
- "Patrimonio Inmobiliario" se usa solo como bajada, nunca como marca: INAPI rechazó esa marca en la clase 36.

## CSS (BEM + Flexbox)

- Los tokens (colores, tipografía, espacios, radios, sombras) están en `src/styles/tokens.css`; reset y estilos base en `src/styles/base.css`.
- Un bloque por archivo en `src/styles/blocks/<bloque>.css`, importado en `src/app/globals.css`. Para un bloque nuevo, crea su archivo e impórtalo ahí.
- Selectores planos `.bloque`, `.bloque__elemento`, `.bloque--modificador`: sin anidar y sin ids para estilos. Layouts con Flexbox.
- Usa siempre las variables de tokens, no colores sueltos.

## Estructura

- `src/app`:
  - `page.tsx`: home.
  - `propiedades/`: listado con filtros, y la ficha en `[slug]`.
  - `servicios/[slug]`: corretaje, tasaciones, asesoria, gestion-patrimonial.
  - `contacto/` y `api/contacto/route.ts`.
  - `acceso/`: ingreso corporativo. `panel/`: área interna, con `clave/`, `usuarios/`, `propiedades/` y `solicitudes/`.
  - `api/auth/` (login, logout, cambiar-clave), `api/panel/usuarios/`, `api/panel/propiedades/` y `api/panel/solicitudes/`.
  - `fotos/[...clave]`: entrega las fotos desde R2. Va fuera de `api/` porque a esas rutas se les aplica una CSP con `sandbox` que rompe el visor del navegador.
  - `sitemap.ts`, `robots.ts`, `not-found.tsx`, `icon.svg`.
- `src/components`:
  - Layout: Header (transparente hasta hacer scroll, con menú móvil), Footer, WhatsAppButton, SectionHead, PageHero.
  - Propiedades: PropertyCard, PropertyMedia, PropertyExplorer (filtros sincronizados con la URL), SearchBar, MortgageCalculator, Gallery (lightbox con `<dialog>`), PropertyMap (mapa de la portada con Leaflet y teselas de OpenStreetMap; carga la librería recién cuando la sección entra en pantalla).
  - Formularios: LeadForm, con variantes `tasacion`, `contacto` y `visita`.
  - Gráficos: Illustration, Icon, Logo.
- `src/data`:
  - `site.ts`: contacto, navegación, comunas y `whatsappHref`.
  - `properties.ts`: tipos y helpers de presentación (`tituloPropiedad`, `comunasDisponibles`). El inventario no vive acá.
  - `services.ts`: 4 servicios, cada uno con lo que incluye, pasos, honorarios y preguntas frecuentes.
- `src/lib`:
  - `format.ts`: números en es-CL y precios en UF/CLP.
  - `filters.ts`: filtros y orden del listado.
  - `leads.ts`: arma el correo del lead (asunto, texto y HTML) y lo envía con Resend.
  - `solicitudes.ts`: guarda en D1 lo que llega por los formularios, mide el tope contra el abuso y lo lista para el panel.
  - `crypto.ts`: funciones puras del acceso (PBKDF2, tokens, RUT, política de contraseñas). Sin imports de Next ni Cloudflare, para que `scripts/crear-admin.mjs` las use tal cual.
  - `auth.ts`: sesiones, cookies y bitácora sobre D1. Reexporta lo de `crypto.ts`.
  - `guardias.ts`: `exigirSesion` y `exigirAdmin` para Server Components. Van aparte porque `redirect()` no sirve dentro de un route handler.
  - `turnstile.ts`: verificación anti-bot, opcional.
  - `db.ts`: bindings de Cloudflare (`DB` y `FOTOS`). Aparte de `auth.ts` para que los módulos de datos no arrastren `next/headers`.
  - `propiedades.ts`: el inventario sobre D1, de lectura pública y de escritura desde el panel.
  - `validar-propiedad.ts`: límites del formulario, compartidos por crear y editar.
  - `imagenes.ts`: valida las imágenes por sus bytes reales, no por la extensión ni el Content-Type.
  - `panel-api.ts`: los chequeos de sesión que repite cada endpoint del panel.
  - `dominio.ts`: decide si el host de la petición es el dominio público. Lo usa `robots.ts` para no dejar indexar la dirección `…workers.dev`.

## Acceso corporativo

- Enlace **Acceso Corporativo** en la cabecera (en terracota, con el ícono `key`), fuera del array `navegacion`: no es navegación pública.
- Se entra con RUT y contraseña en `/acceso`. Dos roles: `ADMIN` gestiona usuarios, `EDITOR` no.
- La autorización se repite en cada página (`exigirSesion` / `exigirAdmin`) y en cada route handler. No hay middleware: OpenNext todavía no soporta el runtime Node de `proxy.ts`.
- Clonado del sistema de AG Casco Histórico: PBKDF2 de 100.000 iteraciones con salt, comparación en tiempo constante, token de sesión de 256 bits guardado solo como SHA-256, bloqueo a los 5 intentos, freno de 20 fallos por IP en 15 minutos, cookie `HttpOnly` + `Secure` + `SameSite=Strict`, y hash de descarte para que un RUT inexistente no se delate por tiempo de respuesta.
- Ninguna contraseña entra al repo. El primer administrador se crea con `node scripts/crear-admin.mjs --rut ... --nombre "..."`, que imprime una clave temporal una sola vez. Desde `/panel/usuarios` se crean las demás cuentas, igual con clave temporal.
- Cambiar o resetear una contraseña cierra todas las sesiones de esa persona. Desactivar una cuenta también.
- Turnstile es opcional: sin `TURNSTILE_SECRET_KEY` el login funciona sin widget. Apenas se define el secreto pasa a ser obligatorio.
- Todo queda en `log_eventos`: `LOGIN_OK`, `LOGIN_FAIL`, `CLAVE_CAMBIADA`, `USUARIO_CREADO`, etc.

## Inventario de propiedades

- Vive en D1, no en archivos. `src/data/properties.ts` quedó solo con los tipos y los helpers de presentación.
- `src/lib/propiedades.ts` es la única puerta a la tabla. Los arreglos (etiquetas, descripción, características) se guardan como JSON en TEXT.
- Dos estados: `BORRADOR` no se ve en el sitio, `PUBLICADA` sí. El sitio público filtra siempre por `estado = 'PUBLICADA'`.
- **La portada, el listado, las fichas y el sitemap son `force-dynamic`.** Es el precio de que publicar desde el panel aparezca al tiro, sin pasar por un deploy. Si el tráfico lo pide, el camino es ISR con caché incremental en R2, no volver a los archivos.
- `PropertyExplorer` filtra en el navegador sobre la lista completa. Sirve bien hasta unos cientos de propiedades; más que eso, los filtros tienen que pasar a SQL.
- Las fotos van a R2 con una clave `propiedades/<id>/<timestamp>-<uuid>.<ext>` y se sirven por `/fotos/`. El bucket no es público.
- La primera foto es la portada. Se reordenan con las flechas del panel: `PUT /api/panel/propiedades/<id>/fotos` recibe el arreglo completo de ids y lo rechaza entero (409) si no calza exactamente con las fotos de esa propiedad, así que una pestaña con la lista vieja no deja la galería a medio ordenar.
- Borrar una propiedad borra también sus objetos de R2: el `ON DELETE CASCADE` solo limpia la tabla, no el bucket.
- **El inventario actual son 20 avisos y 348 fotos capturados del sitio de Corredora Palma Fuentes** (`db/import-palma-fuentes.sql`, con su origen en `db/palma-fuentes-source.json`). `npm run db:seed` y `npm run db:local-seed` corren esa importación; es repetible y no pisa lo editado desde el panel. Las fotos importadas usan claves `palma-fuentes/<id>/<orden>-<hash>.<ext>`, que `claveValida()` acepta además de las del panel.
- Los cambios de esquema sobre una base que ya existe van en `db/migrations/`, y `db/schema.sql` los incluye para bases nuevas. **Una migración se aplica a la D1 real antes de pushear el código que la necesita**: las consultas nombran sus columnas, así que si el deploy llega primero, todas las páginas públicas responden 500.
- Cada propiedad puede llevar `latitud` y `longitud` para su pin en el mapa de la portada. Publicar exige las dos: lo validan `validar-propiedad.ts` y el endpoint de estado.
- También puede llevar `frente` y `fondo`: las medidas del terreno en metros, con hasta dos decimales. Son opcionales y pueden venir las dos, una o ninguna. Van aparte de los m² porque no se deducen de ellos, y la ficha las muestra como «16 m de frente × 22,5 m de fondo».
- El listado manda al navegador una versión recortada de cada propiedad (sin descripción, características ni galería): `PropertyExplorer` solo necesita lo que muestra la tarjeta.
- Las fotos se sirven con `unoptimized`: el original de R2, sin redimensionar. Las portadas pesan unos 200 KB cada una.

## Cabeceras de seguridad

- Se definen en `headers()` dentro de `next.config.ts`, no en un middleware: `proxy.ts` solo tiene soporte experimental y sin mantención en OpenNext.
- Las páginas llevan CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y `Cross-Origin-Opener-Policy`. La API lleva una CSP de `default-src 'none'` con `sandbox`, más `no-store` y `Cross-Origin-Resource-Policy`.
- El patrón `/:ruta((?!api/).*)` existe para que la API no reciba dos CSP; si recibe dos, el navegador aplica la intersección y rompe cosas.
- `script-src` necesita `'unsafe-inline'`: Next inyecta el payload RSC en scripts inline y sin middleware no hay nonce por request. La CSP igual bloquea scripts de terceros, iframes ajenos y `form-action` fuera del sitio.
- **HSTS y `upgrade-insecure-requests` solo si `WORKERS_CI=1` o `COTA_HSTS=1`.** El primero lo pone Cloudflare Workers Builds en cada build suyo, así que el sitio sale con HSTS sin depender de que alguien configure una variable; el segundo queda para forzarlo desde otro lado. En localhost dejarían el origen pineado a https y romperían cualquier otro servidor local por http. Las cabeceras se fijan al compilar, así que la variable tiene que estar puesta ya en el `npm run build`.
- `public/_headers` cubre los archivos estáticos, que sirve Workers Assets sin pasar por el Worker.
- `img-src` permite `https://tile.openstreetmap.org`, de donde salen las teselas del mapa. Es el único origen externo de imágenes.
- `robots.txt` cierra el sitio entero (`Disallow: /`) cuando el host no es el dominio público, para que los buscadores no indexen la dirección `…workers.dev`. Se abre solo cuando `cotaclara.cl` apunte al Worker.
- Al tocar la CSP hay que probar en el navegador, no solo con curl: una directiva de más no cambia los códigos HTTP, pero rompe la página en silencio.

## Pruebas

- `npm test` corre la suite una vez; `npm run test:watch` la deja mirando los archivos. El workflow de GitHub la corre en cada push, pero no frena el deploy: ver la sección de stack.
- Vitest con `@cloudflare/vitest-plugin`, así que **corren dentro de workerd**, el mismo runtime del deploy, con una D1 de miniflare. Por eso PBKDF2, `crypto.subtle` y las consultas se prueban contra las APIs reales.
- La configuración va en `vitest.config.mts`. Tiene que ser `.mts`: el plugin es solo ESM y con `.ts` Vite lo carga con `require` y falla.
- No lee `wrangler.jsonc` (`config: false`): así las pruebas nunca tocan la base ni el bucket reales. Declara su propia D1 y su propio R2.
- `tests/esquema.ts` aplica `db/schema.sql` y vacía las tablas antes de cada prueba. Lee el esquema de verdad, no una copia: si una migración rompe una consulta, se cae la suite.
- Las pruebas que tocan la base reemplazan `@/lib/db` con la D1 y el R2 de miniflare. Es la única forma de probar esos módulos sin el contexto de Cloudflare.
- Los route handlers se prueban llamándolos directo con un `Request` armado a mano: son funciones que reciben un `Request` y devuelven un `Response`, no hace falta levantar Next. `tests/sesion.ts` arma la cookie de sesión sin pasar por el login.
- Cubren `src/lib`: RUT y contraseñas (`crypto`), firma real de las imágenes y claves de R2 (`imagenes`), límites del formulario (`validar-propiedad`), filtros y orden del listado (`filters`), formatos en es-CL (`format`) y el inventario sobre D1 (`propiedades`).
- Y los endpoints: login con bloqueo por intentos y freno por IP, cambio de clave, logout, alta y baja de usuarios, CRUD de propiedades, subida y borrado de fotos, reordenar, y la entrega desde R2 en `/fotos`.
- También el formulario de contacto: que la solicitud quede guardada aunque el correo falle o no esté configurado, que solo avise del error cuando no quedó en ninguna parte, el tope por conexión y el borrado desde el panel. Ahí Resend va mockeado, igual que Turnstile en el login.
- Turnstile va mockeado en las pruebas del login: sale a pedirle el veredicto a Cloudflare. Lo que se prueba es que el login lo respete.
- Lo que no cubren: los componentes, los Server Components del panel (`guardias.ts`), la llamada real a Resend de `leads.ts` y la propia llamada a Turnstile.

## Contenido de ejemplo (reemplazar antes de publicar)

- **Propiedades:** las 20 publicadas son avisos de otra corredora, Palma Fuentes, con sus fotos. Antes de salir con el dominio propio hay que confirmar que existe autorización para publicarlos, y revisar que cada aviso siga vigente.
- **Contacto:** en `site.ts`, teléfono, WhatsApp, email y dirección son placeholders **y ya están en vivo**: el botón de WhatsApp del sitio abre un chat con un número que no es de la firma. `site.url` es `https://www.cotaclara.cl`.
- **Honorarios:** los de `services.ts` son referenciales; hay que confirmarlos con el cliente.
- **Leads:** `api/contacto` valida nombre, email, el consentimiento `acepto` y el honeypot `empresa`. **Primero guarda la solicitud en la tabla `solicitudes` y después intenta el aviso por correo** con Resend (`src/lib/leads.ts`): el correo es solo el aviso, el registro es la base. Responde `ok` si quedó guardada o si el correo salió; recién si fallan las dos cosas responde 503 o 502. Las solicitudes se ven y se borran en `/panel/solicitudes`, y borrarlas es lo que cumple la promesa de privacidad del sitio. Tope contra el abuso: 5 por conexión y 100 en total cada diez minutos; pasado eso responde 429 y no guarda. En el log van el id y el estado, nunca los datos de la persona. Para que además llegue el correo hacen falta `RESEND_API_KEY` y `LEADS_FROM`: en `.env.local` para desarrollo y como secretos del Worker en producción (`npx wrangler secret put RESEND_API_KEY`). Falta verificar el dominio cotaclara.cl en Resend.

## Pendientes sugeridos

1. **Crear el primer administrador en producción**: `node scripts/crear-admin.mjs --rut ... --nombre "..." --remote`. La base real tiene 0 usuarios, así que hoy nadie puede entrar al panel.
2. **Aviso por correo de las solicitudes**: verificar cotaclara.cl en Resend y cargar `RESEND_API_KEY` y `LEADS_FROM` como secretos del Worker. Mientras tanto las solicitudes no se pierden, pero solo se ven entrando a `/panel/solicitudes`: nadie recibe un aviso.
3. **Datos de contacto reales** en `site.ts`: teléfono, WhatsApp, correo y dirección.
4. **Confirmar la autorización** para publicar los avisos y las fotos de Palma Fuentes.
5. Dominio cotaclara.cl apuntando al Worker. Mientras tanto `robots.txt` mantiene el sitio fuera de los buscadores.
6. Honorarios de `services.ts`: confirmarlos con el cliente.
7. Las pruebas cubren `src/lib` y los endpoints; los componentes y las páginas siguen verificándose a mano.
