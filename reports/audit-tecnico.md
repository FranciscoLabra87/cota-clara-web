# Dictamen independiente: código y calidad técnica

Fecha de revisión: 15 de noviembre de 2026, Chile. Especialidad: código, seguridad de aplicación, rendimiento, accesibilidad técnica, datos y operación. Revisión de la copia de trabajo basada en `1ef6a4c`, con la herramienta de fichas técnicas en desarrollo.

## Veredicto

La base tiene controles razonables: consultas preparadas, sesiones con token aleatorio y hash en D1, cookies HttpOnly/SameSite=Strict, guardias por página y endpoint, roles, cambio obligatorio de clave temporal, límite de acceso y solicitudes persistidas antes del correo. No se acreditó un P0 ni un P1 de seguridad activo. La mejora inmediata está en precisión de datos, imágenes, validación de entradas y accesibilidad por teclado. La publicación continua requiere confirmar que las pruebas sean una barrera real.

## Hallazgos

### T1 · P2 · Las medidas y precios UF pierden decimales al guardar

- **Evidencia:** `src/lib/validar-propiedad.ts:23-26` aplica `Math.trunc`; `:82` lo usa para `precioValor` y `:112-113` para superficies útil/total. La función `medida`, en `:48-57`, ya admite decimales para frente y fondo, pero no para las otras superficies. `db/schema.sql` declara esas superficies como INTEGER.
- **Impacto:** un dato de 78,59 m² o UF 2.686,5 no se conserva con su precisión original. Esto afecta especialmente la nueva ficha técnica y cualquier comparación por m². El inventario importado ya puede contener redondeos que no se recuperan cambiando solo el formulario.
- **Recomendación:** separar enteros (dormitorios) de medidas y precios decimales; usar REAL o unidades menores con escala definida; aceptar coma decimal, conservar el dato original y mostrar la precisión apropiada. Revisar los 20 registros de origen antes de modificar datos históricos.
- **Límite:** se acreditó por el validador; no se modificaron registros reales.

### T2 · P2 · Las miniaturas usan los mismos archivos originales que la galería

- **Evidencia:** `src/components/Gallery.tsx:23` y `src/components/PropertyMedia.tsx:19` usan `Image unoptimized`; `Gallery.tsx:78` solicita miniaturas con `sizes="160px"`, pero `unoptimized` evita que `sizes` genere variantes. `Gallery.tsx:53` carga también la imagen principal sin `loading="eager"` ni prioridad. La portada consultada devuelve JPEG desde `/fotos/` con caché inmutable correcta.
- **Impacto:** en celular una miniatura puede descargar un archivo de tamaño de galería; la imagen principal situada sobre el pliegue puede empezar tarde. El costo crece con la cantidad de fotos.
- **Recomendación:** servir variantes de imagen por ancho desde Cloudflare Images o generarlas al subir; miniaturas de 160/320 px, tarjetas y galería por separado. Dar prioridad solo a la primera imagen principal. Mantener la caché inmutable actual.
- **Límite:** no se midieron Core Web Vitals de campo ni se atribuye un valor de LCP. El impacto en bytes depende de cada archivo.

### T3 · P2 · JSON válido pero de tipo incorrecto produce errores 500

- **Evidencia:** `src/app/api/contacto/route.ts:12-18` convierte el resultado a `Record` y accede `body.empresa`; `src/app/api/auth/login/route.ts:40-46` hace lo mismo con `body.rut`. `request.json()` acepta `null`; el cast TypeScript no lo convierte en objeto. Otras rutas del panel repiten el patrón. El nuevo endpoint de ficha sí rechaza null/array explícitamente.
- **Impacto:** un request `Content-Type: application/json` con cuerpo `null` cae fuera del manejo de JSON inválido y termina en excepción. Genera errores operacionales evitables y respuestas inconsistentes.
- **Recomendación:** validar después de parsear que el cuerpo sea un objeto no nulo y no un arreglo, con helper compartido; responder 400 y probar null, arreglos y primitivas en endpoints públicos y administrativos.
- **Límite:** verificación estática del flujo; no se enviaron requests destructivos a producción.

### T4 · P2 · El menú móvil no contiene el foco del teclado

- **Evidencia:** `src/components/Header.tsx:26-40` bloquea scroll y maneja Escape; `:105-111` usa `inert` solo sobre el menú cerrado. El `<main>` y el pie siguen interactivos cuando el panel visual ocupa la pantalla. No hay captura de Tab ni devolución explícita de foco al botón al cerrar.
- **Impacto:** usuarios de teclado o tecnología asistiva pueden llegar a enlaces ocultos detrás del menú, perder su ubicación o navegar el contenido sin verlo.
- **Recomendación:** usar un dialog modal o una implementación equivalente con foco inicial, Tab contenido, resto de la página inerte y restauración del foco al botón. Conservar Escape y reducción de movimiento.
- **Límite:** hallazgo por estructura/eventos; conviene confirmar el recorrido con lector de pantalla y teclado en móvil/escritorio.

### T5 · P2 · Cada ficha consulta e hidrata el inventario completo para obtener tres relacionadas

- **Evidencia:** `src/app/propiedades/[slug]/page.tsx:27` lee la propiedad para metadata y `:93` vuelve a leerla; `:98-99` carga todas las publicadas y luego filtra tres. `src/lib/propiedades.ts:110-141` trae las fotos completas de todo el conjunto. Listado y panel también carecen de paginación de servidor (`:137-141`, `:168-174`).
- **Impacto:** la latencia y lecturas crecen con el inventario, incluso cuando el usuario abre una sola propiedad. Con 20 fichas el volumen es manejable; será una limitación al ampliar captación.
- **Recomendación:** consulta dedicada de relacionadas con filtros/LIMIT y solo portada; deduplicar por request la consulta de la ficha; paginar listado y panel cuando el volumen lo requiera. No introducir caché que retrase publicación sin invalidación definida.
- **Límite:** no se realizó prueba de carga ni se afirma saturación actual de D1.

### T6 · P2 · El repositorio no garantiza que una prueba fallida impida publicar

- **Evidencia:** `.github/workflows/ci.yml:3-10` explica que Cloudflare despliega por separado y no espera el workflow. Las pruebas y el build de GitHub están en `:40-45`; el script `deploy` de `package.json` compila y publica sin ejecutar `npm test`.
- **Impacto:** puede llegar a producción una regresión que el conjunto de pruebas detecta, si se publica con un camino que no ejecuta dichas pruebas.
- **Recomendación:** comprobar el comando real de Workers Builds y exigir `npm test && npm run build`; para despliegues manuales, usar un comando único verificado. Evitar dos publicadores automáticos concurrentes.
- **Límite importante:** no se accedió a la configuración de Workers Builds; podría estar corregida allí. Confirmarla antes de declarar que existe un despliegue sin barrera en producción.

### T7 · P2 · La bitácora conserva IP y eventos sin política técnica de vencimiento

- **Evidencia:** `src/lib/auth.ts:167-181` guarda eventos e IP en `log_eventos`; `db/schema.sql:45-55` no define caducidad y no se encontró tarea de depuración de esa tabla. En contraste, `src/lib/solicitudes.ts:45-48` sí borra IP de solicitudes después de un día. El límite de login consulta solo los últimos 15 minutos.
- **Impacto:** aumenta indefinidamente la información personal retenida y el tamaño operativo de la bitácora, aunque la IP antigua ya no ayude al límite de acceso.
- **Recomendación:** acordar retención con el responsable del negocio; anonimizar IP al vencer la ventana útil y depurar o archivar eventos según necesidad de auditoría. Automatizar y probar la tarea.
- **Límite:** no se consultó el tamaño real de la tabla ni políticas externas de la empresa; esto es un hallazgo de diseño de retención, no una conclusión legal.

### T8 · P3 · La validación de fecha acepta días imposibles

- **Evidencia:** `src/lib/validar-propiedad.ts:67` usa regex y `Date.parse`; JavaScript normaliza, por ejemplo, `2026-02-31` al mes siguiente en lugar de rechazarlo.
- **Impacto:** una fecha incorrecta puede guardarse como publicación, alterar el orden de inventario o salir en el sitemap.
- **Recomendación:** comparar año/mes/día resultantes con los recibidos o usar una validación de calendario explícita. Incluir año bisiesto y fin de mes en pruebas.
- **Límite:** el control de fecha del navegador frena muchos casos normales; la API sigue necesitando validación propia.

## Pruebas y límites

- Lectura de módulos de sesión, criptografía, login, contacto, propiedades, fotos, solicitudes, visitas y componentes críticos; lectura de AGENTS y documentación local Next 16.
- Consulta HTTP de la portada publicada: 200; respuesta aproximada de 146.722 bytes sin atribuir eso a tamaño transferido comprimido; CSP y HSTS presentes. Fotos públicas con `public, max-age=31536000, immutable`.
- `npm audit --omit=dev --json`: cero vulnerabilidades conocidas informadas por el registro para dependencias de producción en esta ejecución. Esto no sustituye revisión de código.
- No se ejecutaron pruebas duplicadas ni build paralelo al trabajo de root; usar los resultados de su gate final. No se hizo pentest, carga, inspección de secretos, acceso a clientes, datos sensibles ni cambios en producción.
- No se editaron archivos de implementación. La nueva herramienta de fichas debe probar explícitamente autenticación, separación entre ficha para cliente e interna, ausencia de observaciones internas en la exportación para cliente y persistencia de los antecedentes.
