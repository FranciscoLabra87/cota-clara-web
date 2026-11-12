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
- Se despliega en **Cloudflare Workers** con `@opennextjs/cloudflare`. Bindings en `wrangler.jsonc`: `DB` (D1) e `IMAGES`.
- Comandos: `npm install` · `npm run dev` (http://localhost:3000) · `npm run build` · `npm start`.
- Base local: `npm run db:local-schema` la crea, `npm run db:local-consulta -- "SELECT ..."` la consulta. `next dev` la monta sola desde `.wrangler/state`.
- `npm run preview` compila el Worker y lo corre en workerd, el runtime real. La documentación de OpenNext dice que Windows no está soportado, pero acá funciona; si algún día se rompe, la salida es WSL.
- El deploy lo hace GitHub Actions (`.github/workflows/deploy.yml`) en cada push a `main`. Sin los secretos de Cloudflare compila igual y se salta el deploy.
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
  - `acceso/`: ingreso corporativo. `panel/`: área interna, con `clave/` y `usuarios/`.
  - `api/auth/` (login, logout, cambiar-clave) y `api/panel/usuarios/`.
  - `sitemap.ts`, `robots.ts`, `not-found.tsx`, `icon.svg`.
- `src/components`:
  - Layout: Header (transparente hasta hacer scroll, con menú móvil), Footer, WhatsAppButton, SectionHead, PageHero.
  - Propiedades: PropertyCard, PropertyMedia, PropertyExplorer (filtros sincronizados con la URL), SearchBar, MortgageCalculator, Gallery (lightbox con `<dialog>`).
  - Formularios: LeadForm, con variantes `tasacion`, `contacto` y `visita`.
  - Gráficos: Illustration, Icon, Logo.
- `src/data`:
  - `site.ts`: contacto, navegación, comunas y `whatsappHref`.
  - `properties.ts`: 8 propiedades de ejemplo.
  - `services.ts`: 4 servicios, cada uno con lo que incluye, pasos, honorarios y preguntas frecuentes.
- `src/lib`:
  - `format.ts`: números en es-CL y precios en UF/CLP.
  - `filters.ts`: filtros y orden del listado.
  - `leads.ts`: arma el correo del lead (asunto, texto y HTML) y lo envía con Resend.
  - `crypto.ts`: funciones puras del acceso (PBKDF2, tokens, RUT, política de contraseñas). Sin imports de Next ni Cloudflare, para que `scripts/crear-admin.mjs` las use tal cual.
  - `auth.ts`: sesiones, cookies y bitácora sobre D1. Reexporta lo de `crypto.ts`.
  - `guardias.ts`: `exigirSesion` y `exigirAdmin` para Server Components. Van aparte porque `redirect()` no sirve dentro de un route handler.
  - `turnstile.ts`: verificación anti-bot, opcional.

## Acceso corporativo

- Enlace **Acceso Corporativo** en la cabecera (en terracota, con el ícono `key`), fuera del array `navegacion`: no es navegación pública.
- Se entra con RUT y contraseña en `/acceso`. Dos roles: `ADMIN` gestiona usuarios, `EDITOR` no.
- La autorización se repite en cada página (`exigirSesion` / `exigirAdmin`) y en cada route handler. No hay middleware: OpenNext todavía no soporta el runtime Node de `proxy.ts`.
- Clonado del sistema de AG Casco Histórico: PBKDF2 de 100.000 iteraciones con salt, comparación en tiempo constante, token de sesión de 256 bits guardado solo como SHA-256, bloqueo a los 5 intentos, freno de 20 fallos por IP en 15 minutos, cookie `HttpOnly` + `Secure` + `SameSite=Strict`, y hash de descarte para que un RUT inexistente no se delate por tiempo de respuesta.
- Ninguna contraseña entra al repo. El primer administrador se crea con `node scripts/crear-admin.mjs --rut ... --nombre "..."`, que imprime una clave temporal una sola vez. Desde `/panel/usuarios` se crean las demás cuentas, igual con clave temporal.
- Cambiar o resetear una contraseña cierra todas las sesiones de esa persona. Desactivar una cuenta también.
- Turnstile es opcional: sin `TURNSTILE_SECRET_KEY` el login funciona sin widget. Apenas se define el secreto pasa a ser obligatorio.
- Todo queda en `log_eventos`: `LOGIN_OK`, `LOGIN_FAIL`, `CLAVE_CAMBIADA`, `USUARIO_CREADO`, etc.

## Contenido de ejemplo (reemplazar antes de publicar)

- **Propiedades:** son ficticias. Sin fotos se muestra una ilustración SVG de `Illustration.tsx` (`ilustracion: { seed, tono }`). Para usar fotos reales, deja los archivos en `public/propiedades/` y agrega `imagenes: ['/propiedades/x.jpg']` a la propiedad.
- **Contacto:** en `site.ts`, teléfono, WhatsApp, email y dirección son placeholders. `site.url` es `https://www.cotaclara.cl`.
- **Honorarios:** los de `services.ts` son referenciales; hay que confirmarlos con el cliente.
- **Leads:** `api/contacto` valida nombre, email, el consentimiento `acepto` y el honeypot `empresa`, y manda el lead por correo con Resend (`src/lib/leads.ts`). Necesita `RESEND_API_KEY` y `LEADS_FROM` en `.env.local`; las variables están documentadas en `.env.example`. Sin esas dos el lead solo queda en el log del servidor y la ruta responde `ok`. Si Resend falla, responde 502 y el `LeadForm` muestra su alerta con el correo de respaldo. Falta verificar el dominio cotaclara.cl en Resend.

## Pendientes sugeridos

1. Crear la D1 real (`npx wrangler d1 create cota-clara-db`) y pegar el `database_id` en `wrangler.jsonc`, que hoy tiene un placeholder.
2. Dejar `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` como secretos del repo para que corra el workflow.
3. Etapa 2 del panel: propiedades en D1, CRUD y fotos en R2. Hoy siguen en `src/data/properties.ts` y las fichas son estáticas.
4. Datos de contacto reales y fotos.
5. Verificar cotaclara.cl en Resend y dejar `RESEND_API_KEY` y `LEADS_FROM` en `.env.local`.
6. Dominio cotaclara.cl apuntando al Worker.
