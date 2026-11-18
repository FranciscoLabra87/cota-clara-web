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
- En vivo en `https://www.cotaclara.cl` y `https://cotaclara.cl`, ambos apuntando al Worker.
- **Correo:** `cotaclara.cl` está registrado en NIC Chile y delegado a Cloudflare (`mona` y `darwin.ns.cloudflare.com`), así que todo el DNS se maneja en Cloudflare. Los buzones viven en el hosting de WireNet: el 18 de noviembre de 2026 el MX ya apuntaba a `host12.wirenetchile.com`, con SPF (`ip4:138.117.150.12`), DKIM (`default._domainkey`) y DMARC `p=none`. `contacto@cotaclara.cl` es el buzón de comunicación del equipo. `info@cotaclara.cl` es el remitente de todo lo automático, el «no responder» (`LEADS_FROM` = `Cota Clara <info@cotaclara.cl>`), y no es una casilla real: no existe en el hosting.
- **El correo saliente va por Resend** (`src/lib/correo.ts`, con `fetch` a su API, sin paquete). El dominio `cotaclara.cl` está verificado en Resend (DKIM en `resend._domainkey` y el subdominio `send`). Basta con los secretos `RESEND_API_KEY` y `LEADS_FROM` del Worker. Si se borra `RESEND_API_KEY`, el mismo código cae al SMTP del hosting (`src/lib/smtp.ts`, con `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` y `SMTP_PASS`); en el Worker quedaron cargados los tres primeros apuntando a `host12.wirenetchile.com` con `info@`, sin contraseña, y no se usan mientras exista la clave de Resend. Plan gratis de Resend: 3.000 correos al mes y 100 al día.
- Comandos: `npm install` · `npm run dev` (http://localhost:3000) · `npm run build` · `npm start`.
- **`npm run build` es `opennextjs-cloudflare build`**, no `next build`: compila Next y empaqueta el Worker en `.open-next/`, que es lo que se despliega. Tarda más, pero es lo que sale al aire. Para una revisión rápida de tipos y compilación está `npm run build:next`.
- Por eso `open-next.config.ts` fija `buildCommand: 'next build'`. Si no, OpenNext correría `npm run build`, que ahora es él mismo, y se llamaría en círculo.
- Base local: `npm run db:local-schema` la crea, `npm run db:local-consulta -- "SELECT ..."` la consulta. `next dev` la monta sola desde `.wrangler/state`.
- `npm run preview` compila el Worker y lo corre en workerd, el runtime real. La documentación de OpenNext dice que Windows no está soportado, pero acá funciona; si algún día se rompe, la salida es WSL.
- **El deploy lo hace Cloudflare Workers Builds**, conectado al repo desde el panel de Cloudflare: despliega en cada push a `main`. Funciona con los comandos que Cloudflare trae por defecto (`npm run build` y `npx wrangler deploy`) justamente porque `npm run build` arma el Worker; no hay que configurar nada en el panel. El deploy busca `.open-next/.build/open-next.config.edge.mjs`: si ese archivo no está, responde «Could not find compiled Open Next config».
- **El botón Retry del panel reconstruye el mismo commit de esa corrida, no el último.** Si el arreglo está en un commit posterior, Retry lo vuelve a fallar igual. Para probar un arreglo hay que pushear.
- GitHub Actions (`.github/workflows/ci.yml`) **no despliega**: corre las pruebas y el build como control. Cloudflare no lo espera, así que una prueba caída se ve en GitHub pero no frena el deploy; para que lo frenara habría que correr `npm test` también en el build command de Cloudflare.
- **El `main` del Worker es `worker.ts`**, no `.open-next/worker.js`: atiende las dos rutas del Drive que mueven muchos bytes (`/drive/subidas/:id/partes/:n` y `/drive/archivos/:id`) pasando el cuerpo directo entre el pedido y R2, y le entrega todo lo demás al Worker de OpenNext. Esas rutas no pasan por Next, así que tampoco por las cabeceras de `next.config.ts`: las suyas las pone `src/lib/drive.ts`. Las mismas dos rutas existen en `src/app/drive/` para `npm run dev`, que no usa `worker.ts`.
- El tamaño del Worker se comprueba con `npx wrangler deploy --dry-run`; el límite actual de Cloudflare es 64 MiB sin comprimir para Free y Paid. `pdf-lib`, de las fichas en PDF, aporta buena parte del paquete.
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
  - `propiedades/`: listado con filtros de todo el inventario, y la ficha en `[slug]`.
  - `proyectos-de-inversion/` y `retail/`: el mismo listado, solo con las nuevas o solo con las usadas. Las tres páginas usan `ListadoPropiedades`.
  - `servicios/[slug]`: corretaje, tasaciones, asesoria, gestion-patrimonial.
  - `contacto/` y `api/contacto/route.ts`.
  - `acceso/`: ingreso corporativo. `panel/`: área interna, con `clave/`, `usuarios/`, `propiedades/`, `solicitudes/`, `fichas/`, `drive/`, `crm/` y `tareas/` (el seguimiento de cada propiedad está en `propiedades/<id>/seguimiento`).
  - `api/auth/` (login, logout, cambiar-clave), `api/panel/usuarios/`, `api/panel/propiedades/`, `api/panel/solicitudes/`, `api/panel/drive/`, `api/panel/crm/` y `api/panel/tareas/`.
  - `drive/`: subida de partes y descarga de archivos del Drive. En producción las atiende `worker.ts`; estas versiones son para `npm run dev`.
  - `fotos/[...clave]`: entrega las fotos desde R2. Va fuera de `api/` porque a esas rutas se les aplica una CSP con `sandbox` que rompe el visor del navegador.
  - `sitemap.ts`, `robots.ts`, `not-found.tsx`, `icon.svg`.
- `src/components`:
  - Layout: Header (transparente hasta hacer scroll, con menú móvil), Footer, WhatsAppButton, SectionHead, PageHero.
  - Panel: CrmTablero (kanban de interesados de una propiedad, con su historial en un `<dialog>`) y TareasTablero (kanban de tareas).
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
  - `leads.ts`: arma el aviso al equipo y la confirmación a la persona (asunto, texto y HTML).
  - `correo.ts`: la puerta del correo saliente. Manda por Resend si hay `RESEND_API_KEY`; si no, por `smtp.ts`, el SMTP del hosting.
  - `solicitudes.ts`: guarda en D1 lo que llega por los formularios, mide el tope contra el abuso y lo lista para el panel.
  - `visitas.ts`: el contador de visitas de las fichas, sumado por propiedad y por día en hora de Chile.
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
  - `texto.ts`: cómo se parten los campos de varias líneas del panel (`lineas` para listas, `parrafos` para la descripción). Lo usan igual el formulario y la validación, para que guardar una ficha sin tocarla no la cambie.
  - `sesion.ts`: la consulta de sesión a partir de la cookie, sin imports de Next. La usan `auth.ts` y el Worker propio.
  - `drive.ts`: el Drive interno sobre R2: tipos permitidos, cuota, subida por partes, lectura, borrado y las respuestas de las dos rutas que atiende `worker.ts`.
  - `crm.ts`: interesados, etapas, actividades y resúmenes del CRM. `crm-etapas.ts` tiene las etapas y los tipos de actividad aparte, para que el tablero, que corre en el navegador, no arrastre el acceso a la base.
  - `tareas.ts`: tareas del equipo, con responsable, fecha límite y enlace a una propiedad o a un interesado. `tareas-estados.ts` tiene las columnas aparte, por la misma razón que `crm-etapas.ts`.
  - `fecha.ts`: `horaDeChile`, que pasa las fechas UTC de SQLite a hora de Chile en el servidor.
  - `json-ld.ts`: serializa los datos estructurados escapando `<`, `>` y `&`. Todo `<script type="application/ld+json">` va por acá, nunca con `JSON.stringify` directo: un texto de la base podría cerrar el bloque y meter un script.

## Acceso corporativo

- Enlace **Acceso Corporativo** en la cabecera (en terracota, con el ícono `key`), fuera del array `navegacion`: no es navegación pública.
- Se entra con RUT y contraseña en `/acceso`. Dos roles: `ADMIN` gestiona usuarios, `EDITOR` no.
- Desde `/panel/usuarios` un administrador cambia el rol de otra cuenta (`POST /api/panel/usuarios/<id>/rol`). Nadie cambia su propio rol: como quien pide el cambio es un administrador activo, así el panel nunca se queda sin administradores. El cambio rige en la siguiente acción de esa persona, sin cerrarle la sesión, porque el rol se lee de la base en cada request. Queda en la bitácora como `ROL_CAMBIADO`, con el rol de antes y el nuevo.
- Cuentas en producción: Francisco Labra (16.367.941-8) y Gustavo Palma (16.319.187-3), los dos administradores.
- La autorización se repite en cada página (`exigirSesion` / `exigirAdmin`) y en cada route handler. No hay middleware: OpenNext todavía no soporta el runtime Node de `proxy.ts`.
- Clonado del sistema de AG Casco Histórico: PBKDF2 de 100.000 iteraciones con salt, comparación en tiempo constante, token de sesión de 256 bits guardado solo como SHA-256, bloqueo a los 5 intentos, freno de 20 fallos por IP en 15 minutos, cookie `HttpOnly` + `Secure` + `SameSite=Strict`, y hash de descarte para que un RUT inexistente no se delate por tiempo de respuesta.
- Ninguna contraseña entra al repo. El primer administrador se crea con `node scripts/crear-admin.mjs --rut ... --nombre "..."`, que imprime una clave temporal una sola vez. Desde `/panel/usuarios` se crean las demás cuentas, igual con clave temporal.
- Si nadie puede entrar a resetear una clave (por ejemplo, el único administrador la perdió), está `node scripts/resetear-clave.mjs --rut ... [--clave ...] --remote`. Sin `--clave` genera una al azar; con `--clave` usa la indicada. En los dos casos queda temporal, desbloquea la cuenta, cierra sus sesiones y lo anota en la bitácora.
- El administrador principal es el RUT 16.367.941-8. Su clave inicial se dejó, a pedido suyo, como los 4 últimos números del RUT antes del guion; al primer ingreso el sistema obliga a cambiarla. Para las cuentas de los socios el panel genera claves al azar, a propósito: una clave derivada del RUT la adivina cualquiera que lo conozca, y la cuenta queda expuesta hasta el primer ingreso de su dueño.
- Cambiar o resetear una contraseña cierra todas las sesiones de esa persona. Desactivar una cuenta también.
- Turnstile es opcional: sin `TURNSTILE_SECRET_KEY` el login funciona sin widget. Apenas se define el secreto pasa a ser obligatorio.
- Todo queda en `log_eventos`: `LOGIN_OK`, `LOGIN_FAIL`, `CLAVE_CAMBIADA`, `USUARIO_CREADO`, etc.

## Inventario de propiedades

- Vive en D1, no en archivos. `src/data/properties.ts` quedó solo con los tipos y los helpers de presentación.
- `src/lib/propiedades.ts` es la única puerta a la tabla. Los arreglos (etiquetas, descripción, características) se guardan como JSON en TEXT.
- Dos estados: `BORRADOR` no se ve en el sitio, `PUBLICADA` sí. El sitio público filtra siempre por `estado = 'PUBLICADA'`.
- **Dos segmentos**, en la columna `condicion`: `nuevo` son los **Proyectos de inversión** (`/proyectos-de-inversion`) y `usado` es **Retail** (`/retail`). Por defecto, usado; se elige en el panel. El menú lleva un enlace a cada uno, y la portada una vitrina por segmento (hasta 3, primero las destacadas) que se oculta si el segmento no tiene publicadas. `/propiedades` sigue con todo junto, fuera del menú: lo usan el buscador de la portada y los enlaces antiguos. Las fichas de los dos segmentos siguen en `/propiedades/<slug>`. Nombres y bajadas de cada segmento en `segmentos` (`src/data/properties.ts`).
- **La portada, el listado, las fichas y el sitemap son `force-dynamic`.** Es el precio de que publicar desde el panel aparezca al tiro, sin pasar por un deploy. Si el tráfico lo pide, el camino es ISR con caché incremental en R2, no volver a los archivos.
- `PropertyExplorer` filtra en el navegador sobre la lista completa. Sirve bien hasta unos cientos de propiedades; más que eso, los filtros tienen que pasar a SQL.
- Las fotos van a R2 con una clave `propiedades/<id>/<timestamp>-<uuid>.<ext>` y se sirven por `/fotos/`. El bucket no es público.
- La primera foto es la portada. Se reordenan con las flechas del panel: `PUT /api/panel/propiedades/<id>/fotos` recibe el arreglo completo de ids y lo rechaza entero (409) si no calza exactamente con las fotos de esa propiedad, así que una pestaña con la lista vieja no deja la galería a medio ordenar.
- Borrar una propiedad borra también sus objetos de R2: el `ON DELETE CASCADE` solo limpia la tabla, no el bucket.
- **El inventario actual son 20 avisos y 348 fotos capturados del sitio de Corredora Palma Fuentes** (`db/import-palma-fuentes.sql`, con su origen en `db/palma-fuentes-source.json`). `npm run db:seed` y `npm run db:local-seed` corren esa importación; es repetible y no pisa lo editado desde el panel. De esos 20, solo Eco Estación es un proyecto nuevo; los otros 19 son usados. Las fotos importadas usan claves `palma-fuentes/<id>/<orden>-<hash>.<ext>`, que `claveValida()` acepta además de las del panel.
- Los cambios de esquema sobre una base que ya existe van en `db/migrations/`, y `db/schema.sql` los incluye para bases nuevas. **Una migración se aplica a la D1 real antes de pushear el código que la necesita**: las consultas nombran sus columnas, así que si el deploy llega primero, todas las páginas públicas responden 500.
- Cada propiedad puede llevar `latitud` y `longitud` para su pin en el mapa de la portada. Publicar exige las dos: lo validan `validar-propiedad.ts` y el endpoint de estado.
- También puede llevar `frente` y `fondo`: las medidas del terreno en metros, con hasta dos decimales. Son opcionales y pueden venir las dos, una o ninguna. Van aparte de los m² porque no se deducen de ellos, y la ficha las muestra como «16 m de frente × 22,5 m de fondo».
- **Descripción:** se escribe en el panel con una línea en blanco entre párrafos; los saltos de línea dentro de un párrafo se respetan y la ficha los muestra (`white-space: pre-line`). Un párrafo de más de 2.000 caracteres o más de 40 párrafos se rechazan con un mensaje, en vez de cortarse en silencio. Las listas cortas (etiquetas, características) sí se recortan a su máximo.
- Cada ficha publica su portada como vista previa al compartirla (`og:image`, `twitter:card` grande), con la URL armada desde el host de la visita para que funcione antes de que apunte el dominio. La canónica va siempre a `site.url`.
- El listado manda al navegador una versión recortada de cada propiedad (sin descripción, características ni galería): `PropertyExplorer` solo necesita lo que muestra la tarjeta.
- Las fotos se sirven con `unoptimized`: el original de R2, sin redimensionar. Las portadas pesan unos 200 KB cada una.
- **Visitas:** la ficha avisa con un `POST /api/visitas` desde el navegador al abrirse (`ContadorVisita`), una vez por ficha y por pestaña. Se cuenta desde el navegador y no al renderizar en el servidor porque Next precarga las fichas cuando sus enlaces aparecen en pantalla, y eso inflaría la cuenta. No cuentan los borradores, las visitas del equipo con sesión abierta ni los buscadores. Se suman en `propiedad_visitas`, una fila por propiedad y por día en hora de Chile, sin guardar nada de quién visitó. Tope de 20.000 visitas contadas por día entre todas las propiedades, para que un script no gaste la cuota de escrituras de D1 y tumbe el formulario y el panel. El panel muestra el total y los últimos 7 días. Son aproximadas: un script podría inflarlas hasta el tope.

## Drive interno

- En `/panel/drive`. Fotos, videos y documentos del equipo en el mismo bucket R2 de las fotos, bajo `drive/<usuario>/`. Cada usuario sube a su carpeta y todos ven y descargan todas. Borra el dueño o un administrador.
- Carga masiva: se arrastran archivos o se elige una carpeta entera (conserva la ruta en el nombre), y se suben de a 3 con barra de avance, reintentos y cancelación.
- Todo se sube por partes de 10 MiB (multipart de R2), también lo chico. Cloudflare corta los pedidos de más de 100 MB; con partes, un archivo de hasta 2 GB sube igual. R2 exige 5 MiB mínimo por parte, salvo la última, y hasta 10.000 partes.
- Las partes y las descargas las atiende `worker.ts` sin copiar los bytes en JavaScript: en el plan gratis de Workers cada pedido tiene 10 ms de CPU. Probado en workerd con un archivo de 25 MB: subió en 3 partes y bajó idéntico.
- La descarga entrega rangos (206), para adelantar videos sin bajarlos enteros.
- **Cuota: 8 GiB por defecto**, para quedar dentro de los 10 GB gratis de R2 al mes, que cubren toda la cuenta. Se cambia con la variable `DRIVE_CUOTA_GB` del Worker, sin tocar código. Pasado el plan gratis, cada GB cuesta US$ 0,015 al mes; subir y bajar no cobra transferencia.
- La cuota se reserva al empezar la subida, en una sola sentencia SQL, así que dos subidas en paralelo no pueden pasarse entre las dos. Las subidas abandonadas hace más de un día se abortan y liberan su espacio.
- Tipos aceptados por extensión, que decide el Content-Type con que se sirve: imágenes, videos, PDF, Office, CSV, TXT, ZIP, DWG y KMZ. Nada de HTML, SVG ni ejecutables. Fotos, videos y PDF se muestran; lo demás se descarga con una CSP `sandbox`.

## CRM

- En `/panel/crm` está la tabla con todas las propiedades y sus números: visitas web, interesados activos, llamadas, visitas físicas y el último contacto. Cada una abre su tablero en `/panel/propiedades/<id>/seguimiento`.
- El tablero es un kanban de interesados con siete etapas: Nuevo, Contactado, Visita agendada, Visitó, Negociación, Cerrado y Descartado. Las tarjetas se mueven con flechas, que también sirven en el celular.
- Cada interesado tiene un historial (`crm_actividades`) con llamadas, visitas físicas, mensajes y notas. Quién lo registró sale de la sesión. Mover una tarjeta deja también un registro de tipo `etapa`.
- «Último contacto» es la llamada, visita o mensaje más reciente. Las notas y los cambios de etapa no cuentan.
- Una solicitud «Agenda una visita» desde una ficha entra sola como tarjeta Nuevo, con su mensaje como primera nota (`interesadoDesdeSolicitud`). El `UNIQUE` de `solicitud_id` evita duplicarla. Si el paso al CRM falla, la solicitud igual queda guardada.
- Todo el equipo ve y edita. Borra un interesado quien lo agregó o un administrador, y su historial cae con él. Borrar la propiedad borra su CRM.
- En la bitácora van solo los ids, nunca el nombre ni el teléfono del cliente.

## Tareas

- En `/panel/tareas`: un kanban con tres columnas, Por hacer, En curso y Hecha, y dos vistas, Mis tareas y Todas.
- Cada tarea tiene título, detalle, responsable (o sin asignar), fecha límite opcional y puede quedar ligada a una propiedad o a un interesado del CRM. Si viene un interesado, la propiedad se toma de él.
- Desde la tarjeta de un cliente en el CRM se crea una «tarea de seguimiento» a nombre de quien la crea, y ahí mismo se ven las abiertas de ese cliente.
- Vencida es la que no está hecha y cuya fecha ya pasó en hora de Chile. Se marca en terracota, y el inicio del panel muestra cuántas pendientes y vencidas tiene cada persona.
- Las hechas hace más de 30 días salen del tablero, pero no se borran. Borrar una tarea lo puede hacer quien la creó o un administrador. Borrar la propiedad o el interesado deja la tarea, sin el enlace.

## Cabeceras de seguridad

- Se definen en `headers()` dentro de `next.config.ts`, no en un middleware: `proxy.ts` solo tiene soporte experimental y sin mantención en OpenNext.
- Las páginas llevan CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y `Cross-Origin-Opener-Policy`. La API lleva una CSP de `default-src 'none'` con `sandbox`, más `no-store` y `Cross-Origin-Resource-Policy`.
- El patrón `/:ruta((?!api/).*)` existe para que la API no reciba dos CSP; si recibe dos, el navegador aplica la intersección y rompe cosas.
- `script-src` necesita `'unsafe-inline'`: Next inyecta el payload RSC en scripts inline y sin middleware no hay nonce por request. La CSP igual bloquea scripts de terceros (salvo Turnstile y Cloudflare Web Analytics), iframes ajenos (salvo Turnstile y Google) y `form-action` fuera del sitio.
- Cloudflare inyecta el beacon de Web Analytics en cada página: `script-src` permite el host `https://static.cloudflareinsights.com` entero, porque la ruta del script cambia con cada versión (`/beacon.min.js/v…`) y una ruta fija dejaría de calzar. Las mediciones van a `/cdn-cgi/rum` del mismo sitio; `connect-src` suma `https://cloudflareinsights.com` por si algún día se pega el snippet a mano.
- **HSTS y `upgrade-insecure-requests` solo si `WORKERS_CI=1` o `COTA_HSTS=1`.** El primero lo pone Cloudflare Workers Builds en cada build suyo, así que el sitio sale con HSTS sin depender de que alguien configure una variable; el segundo queda para forzarlo desde otro lado. En localhost dejarían el origen pineado a https y romperían cualquier otro servidor local por http. Las cabeceras se fijan al compilar, así que la variable tiene que estar puesta ya en el `npm run build`.
- `public/_headers` cubre los archivos estáticos, que sirve Workers Assets sin pasar por el Worker.
- `img-src` permite `https://tile.openstreetmap.org`, de donde salen las teselas del mapa. Es el único origen externo de imágenes.
- `frame-src` permite `https://www.google.com` por el mapa de la oficina en `/contacto` (`mapaEmbed` en `site.ts`). El embed usa `https://www.google.com/maps?...&output=embed`, sin clave de API; si se cambia a `maps.google.com` redirige y hay que sumar ese origen.
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
- Y los endpoints: login con bloqueo por intentos y freno por IP, cambio de clave, logout, alta, baja y cambio de rol de usuarios, CRUD de propiedades, subida y borrado de fotos, reordenar, y la entrega desde R2 en `/fotos`.
- También el Drive: subida por partes de punta a punta contra el R2 de miniflare, cuota y su reserva, limpieza de abandonadas, permisos de subida y borrado, tipos rechazados, rangos y cabeceras de descarga.
- También el contador de visitas: qué cuenta y qué no, el día en hora de Chile y el tope diario.
- También las tareas: validación, enlace al interesado, Hecha con su fecha, las viejas fuera del tablero, pendientes y vencidas, y permisos de borrado.
- También el CRM: etapas y su registro, resumen y último contacto, entrada desde el formulario sin duplicar, permisos de borrado y borrado en cascada.
- También el formulario de contacto: que la solicitud quede guardada aunque el correo falle o no esté configurado, que solo avise del error cuando no quedó en ninguna parte, el tope por conexión, la confirmación a la persona (cuándo sale, su tope por correo y que no repita lo escrito), el contador de sin responder, la respuesta y el borrado desde el panel. Ahí el correo va mockeado, igual que Turnstile en el login. `correo.test.ts` prueba lo que se le pide a Resend (con `fetch` reemplazado) y cuándo cae a SMTP.
- Turnstile va mockeado en las pruebas del login: sale a pedirle el veredicto a Cloudflare. Lo que se prueba es que el login lo respete.
- Lo que no cubren: los componentes, los Server Components del panel (`guardias.ts`), la entrega real de Resend o del SMTP y la propia llamada a Turnstile.

## Contenido de ejemplo (reemplazar antes de publicar)

- **Propiedades:** las 20 publicadas son avisos de otra corredora, Palma Fuentes, con sus fotos. Antes de salir con el dominio propio hay que confirmar que existe autorización para publicarlos, y revisar que cada aviso siga vigente.
- **Contacto:** desde el 17 de noviembre de 2026 `site.ts` tiene los datos reales: teléfono y WhatsApp +56 9 4001 2319, `contacto@cotaclara.cl` y la oficina en Av. Manquehue Norte 882, Edificio Spot Residence Manquehue, Las Condes. `/contacto` muestra esa oficina en un mapa de Google, el pie enlaza la dirección a Google Maps y el JSON-LD de la portada lleva la dirección. Falta confirmar el horario, que sigue siendo el de ejemplo. `site.url` es `https://www.cotaclara.cl`.
- **Honorarios:** los de `services.ts` son referenciales; hay que confirmarlos con el cliente.
- **Leads:** `api/contacto` valida nombre, email, el consentimiento `acepto` y el honeypot `empresa`. **Primero guarda la solicitud en la tabla `solicitudes` y después intenta el aviso por correo** (`src/lib/leads.ts`, por Resend): el correo es solo el aviso, el registro es la base. Responde `ok` si quedó guardada o si el correo salió; recién si fallan las dos cosas responde 503 o 502. **Salen dos correos, en paralelo:** el aviso con todos los datos a `contacto@` (`LEADS_TO` o `site.email`), que es el respaldo, con Reply-To a la persona; y una confirmación a la persona («Tu solicitud fue ingresada con éxito»), desde `info@` con Reply-To a `contacto@` y `Auto-Submitted: auto-generated`. La confirmación solo sale si la solicitud quedó guardada, no repite nada de lo escrito salvo un primer nombre de solo letras (para que nadie use el formulario de relevo de spam hacia terceros), y se corta pasadas 3 solicitudes al mismo correo en 24 horas. Si falla, la persona igual recibe `ok`. Las solicitudes se ven, se responden con nota interna y se borran en `/panel/solicitudes`. El panel muestra cuántas esperan respuesta (estado `pendiente` o `error`): un contador junto a «Solicitudes» en la barra y un aviso en el inicio. Tope contra el abuso: 5 por conexión y 100 en total cada diez minutos; pasado eso responde 429 y no guarda. En el log van el id y el estado, nunca los datos de la persona. La ip de cada solicitud se borra pasado un día, aprovechando cada solicitud nueva. El correo necesita `RESEND_API_KEY` y `LEADS_FROM`: en `.env.local` para desarrollo y como secretos del Worker en producción.

## Pendientes sugeridos

1. **Primer ingreso del administrador** (16.367.941-8) y cambio de su clave inicial. Mientras no entre, la cuenta tiene una clave que se deduce del RUT.
2. **Correo**: probar un envío real por Resend (aviso a `contacto@` y confirmación a quien llena el formulario) y revisar que no caiga en spam. Si falla, mirar `npx wrangler tail` y que la clave siga activa en Resend.
3. **Google**: crear el Perfil de Empresa de Google con la misma dirección y teléfono de `site.ts`, y dar de alta el dominio en Search Console para enviarle `https://www.cotaclara.cl/sitemap.xml`. Las dos cosas las hace el dueño desde su cuenta de Google. Confirmar también el horario de `site.ts`.
4. **Confirmar la autorización** para publicar los avisos y las fotos de Palma Fuentes.
5. Confirmar que `robots.txt` permite indexar solo los dominios públicos y mantiene cerrado `workers.dev`.
6. Honorarios de `services.ts`: confirmarlos con el cliente.
7. Las pruebas cubren `src/lib` y los endpoints; los componentes y las páginas siguen verificándose a mano.
