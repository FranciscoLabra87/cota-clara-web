# Auditoría integral de Cota Clara

**Fecha de corte:** 15 de noviembre de 2026, America/Santiago. **Base revisada:** repositorio en `1ef6a4c` y sitio público en workers.dev. **Método:** tres revisiones independientes del Consejo —UX/conversión, código/calidad técnica y SEO local/GEO/AEO—, contrastadas con fuentes primarias chilenas y páginas oficiales de competidores.

Los hallazgos describen el estado observado **antes de implementar la nueva herramienta corporativa de fichas técnicas**. El resultado de esa implementación y sus pruebas se detalla en el anexo final; las demás recomendaciones conservan su estado de pendientes.

## Veredicto ejecutivo

El sitio tiene una base funcional aprovechable: inventario administrable, mapa, fotografías, consultas persistidas antes del aviso por correo, accesos con roles y guardias, catálogo filtrable y una identidad visual coherente. No se acreditó un P0 ni una vulneración activa grave. La promesa comercial de precisión técnica es clara; falta convertirla en evidencia verificable en cada ficha y en una operación de atención medible.

La prioridad es habilitar el dominio público y su indexación, aprobar información comercial y preparar el tratamiento de datos personales. Después deben resolverse precisión de medidas, errores de API, accesibilidad del menú, imágenes y continuidad entre búsqueda, ficha y consulta. Añadir campañas antes de resolver estos puntos dificultaría separar problemas de adquisición de problemas de confianza y atención.

No hay acceso a ventas, contratos, Search Console, analítica del embudo ni costos de campañas. Por tanto, no se asignan una nota comercial, un volumen de mercado, una cuota competitiva, una pérdida de ingresos o un retorno proyectado.

## Hallazgos consolidados y orden de ejecución

**S/M/L** son estimaciones de esfuerzo relativas, no presupuestos ni compromisos: S = cambio acotado verificable; M = varios componentes o decisiones coordinadas; L = trabajo con terceros, datos o proceso operativo. Son inferencias del equipo. Los responsables son funciones propuestas, no personas cuya asignación ya esté confirmada.

| Prioridad / clasificación | Evidencia y problema | Acción concreta y criterio de cierre | Responsable propuesto / esfuerzo |
|---|---|---|---|
| **P1 · Especialista SEO** | `src/data/site.ts:7` fija www.cotaclara.cl. DNS de raíz y www no resolvió desde este entorno; GET del robots de workers.dev devuelve `Disallow: /`. La canónica de ficha apunta al dominio final. | Conectar el dominio con su titular, fijar raíz o www, TLS y redirección. Cerrar cuando dominio, páginas, robots y sitemap respondan correctamente y Search Console reconozca la propiedad. Mantener preview cerrado al rastreo. | Titular del dominio + infraestructura / M; dependencia externa. |
| **P1 · Consenso de privacidad/datos** | Política de un párrafo en `src/app/contacto/page.tsx:67–73`; bitácora almacena IP sin vencimiento encontrado (`src/lib/auth.ts:167–181`, `db/schema.sql:45–55`). Los nuevos antecedentes técnicos amplían el expediente. | Definir responsable, finalidades, proveedores, bases de tratamiento, retención y derechos; política aprobada y proceso verificable de atención/borrado. Automatizar vencimiento de IP/eventos según necesidad acordada. BCN confirma vigencia de Ley 21.719 desde 01-dic-2026 [F1]. Es una brecha de preparación; no un dictamen de incumplimiento. | Dirección + asesoría competente + backend / M-L. |
| **P1 · Consenso UX/SEO, aprobación pendiente** | `src/data/services.ts:17` dice confirmar honorarios antes de publicar; `:43–44` expone 2% + IVA y 50% de canon + IVA. La página pública de corretaje sirve esos valores. Promete reportes y acompañamiento legal. | Confirmar tarifas, destinatario del cobro, impuestos, alcance, momento de pago y responsables. Documentar aprobación. Si ya estaba aprobada, actualizar el control editorial; no reemplazarla por precios copiados del mercado. | Dirección comercial / S; requiere decisión. |
| **P2 · Consenso UX/SEO** | Contacto identifica marca y ubicación genérica; agente es «Equipo Cota Clara» (`src/data/site.ts:8–13`, ficha `:225–231`). No se encontró página pública de responsables/metodología. | Publicar personas, experiencia comprobable, cobertura y canales operativos; explicar metodología y mostrar entregables autorizados. No inventar acreditaciones, domicilio ni reseñas. | Dirección + contenido / M. |
| **P2 · Consenso técnico/SEO/datos** | `Math.trunc` en `src/lib/validar-propiedad.ts:23–26,82,112–113` redondea medidas/precios; antecedentes técnicos iniciales carecen de fuente/fecha documental. | Conservar precisión decimal de superficies/precio UF con escala definida; cotejar inventario original antes de corregirlo. En fichas, separar dato informado, verificado y pendiente, con documento/fecha/responsable. Cerrar con prueba de ida y vuelta de decimales y revisión editorial. | Backend + responsable técnico inmobiliario / M. |
| **P2 · Especialista técnico** | APIs parsean JSON y lo tratan como objeto sin comprobar `null` (`src/app/api/contacto/route.ts:12–18`, login `:40–46` y rutas similares). `Date.parse` acepta normalización de días imposibles (`validar-propiedad.ts:67`). | Helper de cuerpo JSON no nulo/no array y validación de calendario. Respuestas 400/422 coherentes; pruebas de null, primitivas y fechas límite. | Backend / S-M. |
| **P2 · Consenso UX/técnico** | Menú bloquea scroll y cierra con Escape, pero no contiene/restaura foco ni bloquea el fondo (`src/components/Header.tsx:26–40,105–111`). | Elegir patrón accesible para panel de pantalla completa; foco inicial, Tab contenido, fondo inerte y restauración al disparador. Probar teclado y lector de pantalla además de revisión visual. | Frontend / S-M. |
| **P2 · Especialista técnico** | Galería y miniaturas usan `Image unoptimized`; la principal no tiene carga prioritaria (`Gallery.tsx:23,53,78`, `PropertyMedia.tsx:19`). Ficha hidrata inventario completo para tres relacionadas (`[slug]/page.tsx:98–99`). | Variantes por ancho, prioridad solo para primera imagen, consulta de relacionadas con LIMIT y deduplicación por request. Medir bytes y tiempo antes/después; no atribuir Core Web Vitals sin medirlos. | Frontend + backend / M. |
| **P2 · Especialista técnico, configuración pendiente** | CI documenta despliegue separado de Cloudflare; `deploy` compila/publica sin `npm test` (`.github/workflows/ci.yml:3–10,40–45`, package.json). | Confirmar comando real de Workers Builds y un único camino que exija pruebas y build exitosos. Cerrar al demostrar que un gate fallido impide la publicación. No se accedió a la configuración remota. | Infraestructura / S-M. |
| **P2 · Consenso UX/SEO local** | Tasación ofrece seis comunas de Santiago + «Otra» (`site.ts:24`, `LeadForm.tsx:122–135`), aunque catálogo cubre tres regiones. No hay recursos editoriales propios por comuna. | Definir cobertura de cada servicio y reflejarla en formulario; permitir escribir «Otra». Crear 2–3 páginas locales útiles solo donde exista oferta/conocimiento, con inventario, autor y fecha. | Comercial + contenido + frontend / M. |
| **P2 · Especialista UX** | Sin resultados promete guardar búsqueda sin CTA (`PropertyExplorer.tsx:151–156`); ficha no reutiliza mapa real (`[slug]/page.tsx:198–205`); contacto móvil queda tras contenido y WhatsApp global es genérico. | Capturar búsqueda con filtros ya cargados, mapa consistente en detalle y consulta contextual visible en móvil. Conservar datos ante error y ofrecer canal alternativo. Medir paso a consulta, no asumir incremento. | Frontend + atención / M. |
| **P2/P3 · Especialista SEO** | Canonical solo en fichas; JSON-LD solo de agencia en portada; sitemap usa publicación aunque haya edición; descripción global limita cobertura a Santiago. | Canonical por ruta, entidad estable, schema visible/coherente de servicio/inmueble y breadcrumbs, fecha real de edición y cobertura aprobada. Validar sintaxis e indexación; no prometer rich results. | SEO + frontend/backend / M. |

## Coincidencias y puntos aún abiertos

El Consejo coincide en que la mejora principal debe apoyar la credibilidad: responsables identificables, promesas aprobadas, datos exactos y procedencia documental. UX y técnico coinciden en el foco del menú. UX y SEO coinciden en desajuste de cobertura y continuidad de la información local. SEO y técnico conectan privacidad visible con retención real de datos.

No hubo desacuerdos sobre hechos acreditados. Hubo diferencias de prioridad: UX asignó P1 a aprobación comercial; SEO lo evaluó P2. Se consolida como P1 **condicionado a confirmar la aprobación**, porque influye en expectativas antes de contratar. El riesgo de publicación sin gate queda pendiente de revisar en Cloudflare; el repositorio por sí solo no demuestra el comando remoto.

La falla DNS se volvió a observar al preparar esta síntesis y robots de workers.dev siguió cerrado. Es una observación del resolvedor del entorno; falta comprobación desde la cuenta del titular y otros resolvedores. El teléfono coincide con el ejemplo de la guía, pero no se acreditó que sea falso: se debe probar con el equipo, no sustituirlo por uno supuesto.

## Mercado chileno: hechos verificables y decisiones propuestas

### Contexto financiero y documental

El Banco Central muestra **4,10% para octubre de 2026**, actualizado el **9 de noviembre de 2026**, en su serie de tasa promedio de vivienda en UF a más de tres años [F2]. La metodología indica promedio ponderado de operaciones efectivas en Gran Santiago/RM; no representa una cotización disponible para todo comprador ni caracteriza por sí sola Valparaíso o Coquimbo. La encuesta bancaria publicada el **14 de octubre de 2026**, correspondiente al tercer trimestre, informa flexibilización y mayor demanda percibida en vivienda [F3]. Esa percepción agregada no demuestra aprobación fácil ni pronostica ventas de Cota Clara.

**Inferencia para el producto:** mostrar supuestos del simulador, fecha y costos excluidos; orientar a preparación documental antes de pedir datos financieros extensos. Para el expediente, distinguir avalúo fiscal de valor comercial [F4] y certificado de avalúo de acreditación de dominio [F5]. MINVU y el conservador competente aportan documentos diferentes; una ficha comercial no los reemplaza [F6–F7].

### Señales cuantitativas y alcance

| Señal comprobada al corte | Valor y fuente | Uso proporcionado para Cota Clara |
|---|---|---|
| Venta nacional de viviendas nuevas | 10.833 unidades en II-2026, frente a 10.465 en I-2026 y 10.958 en II-2025. La serie define ventas como promesas firmadas; última actualización 30-sep-2026. [BCCh/CChC](https://si3.bcentral.cl/siete/ES/Siete/Cuadro/CAP_IND_SEC/MN_IND_SEC20/IS_CONS?idSerie=F034.VVNN.FLU.CCHC.Z.0.T). | Comparar período y segmento antes de hablar de recuperación. La serie no mide la venta usada, arriendos ni la demanda de una comuna concreta. |
| Financiamiento habitacional | Promedio UF a más de tres años: 4,10% en octubre de 2026, con alcance RM/Gran Santiago indicado por la metodología. [BCCh](https://si3.bcentral.cl/siete/ES/Siete/Cuadro/CAP_TASA_INTERES/MN_TASA_INTERES_09/TSF_27?idSerie=F022.VIV.TIP.MA03.UF.Z.M). | Mostrar supuestos de financiamiento y fecha de referencia; pedir cotización personal al banco. No convertir esta media en una oferta garantizada. |
| Condiciones bancarias | Encuesta del III-2026: 30% de entidades reporta condiciones de vivienda más flexibles; 40% percibe fortalecimiento de demanda. [BCCh, 14-oct-2026](https://www.bcentral.cl/contenido/-/details/prensa/nota-de-prensa/encuesta-de-credito-bancario-tercer-trimestre-2026). | Hipótesis comercial: ayudar a preparar documentación y entender el costo completo. La encuesta no predice la aprobación de un cliente ni la venta de una propiedad. |

Para arriendos, vacancia, rentas efectivas y precios de cierre de vivienda usada por comuna, esta revisión no obtuvo una serie primaria comparable al corte. No se extrapolan valores de publicaciones ni se promete rentabilidad. La siguiente fase de estudio debe construir comparables locales con fecha, superficie, moneda, estado, fuente y distinción entre precio pedido y cierre documentado.

### Comparación funcional

No se compara cuota de mercado ni se verifican promesas de resultados de competidores. Se comparan elementos observables en sus propios sitios.

| Referente y fuente primaria | Capacidad observada | Decisión sugerida para Cota Clara |
|---|---|---|
| [TOCTOC](https://www.toctoc.com/) | Búsqueda territorial y por código; rutas de tasación y financiamiento. | Hacer reencontrable cada propiedad y conectar contenido local con inventario real. |
| [Houm Chile](https://houm.com/cl) | Rutas por intención, gastos comunes visibles en tarjetas y exposición de responsables/reseñas. | Priorizar costo mensual, persona responsable y siguiente paso claro, con evidencia propia. |
| [Fuenzalida](https://fuenzalida.com/fuenzalida/) | Región/comuna/sector, código y mapa; publicación y administración diferenciadas. | Alinear mapa, ficha y cobertura de servicio; captar propietarios sin mezclar su ruta con compradores. |
| [Capitalizarme](https://conoce.capitalizarme.com/simular-id25/) | Flujo guiado de capacidad de inversión y explicación de etapas. | Explicar financiamiento gradualmente y pedir antecedentes solo con finalidad y protección definidas. |

La propuesta de Cota Clara puede centrarse en **pocas fichas bien verificadas y atención responsable**. Es una hipótesis estratégica compatible con su marca, no una ventaja competitiva demostrada.

### Segmentos territoriales y por intención

El inventario revisado contiene oferta en Metropolitana, Valparaíso y Coquimbo. No se dispone de participación regional, absorción, vacancia, rentabilidad ni volumen de búsquedas propio. Las siguientes prioridades son hipótesis para validar con solicitudes, visitas y comparables, no afirmaciones de demanda regional.

| Territorio | Punto de partida verificable | Experimento propuesto |
|---|---|---|
| Santiago/RM | El catálogo contempla comunas de Santiago y la marca identifica Providencia como área. | Separar compra para vivir de inversión; mostrar gastos comunes, conectividad con fuente y supuestos del dividendo. Validar qué comunas generan consultas calificadas. |
| Valparaíso | Oferta en Viña del Mar, Quilpué, Villa Alemana y ficha con inconsistencia editorial Valparaíso/Concón anotada en fuente. | Auditar comuna y coordenadas; describir uso residencial permanente o alternativa pertinente solo si el inmueble lo permite. No inferir renta turística ni ocupación. |
| Coquimbo | Oferta revisada en Ovalle. | Página local con responsable/cobertura real, tipos de inmueble y proceso de visita. Evitar ampliar automáticamente la promesa a La Serena/Coquimbo si no existe operación allí. |

| Intención | Información que permite decidir | Conversión que debe registrar el equipo |
|---|---|---|
| Compra | Precio y moneda; superficies/fuentes; pie y costos; recepción/antecedentes pendientes; entorno comprobable. | Consulta calificada → visita → oferta → cierre. |
| Arriendo | Canon, gastos comunes y otros cobros conocidos; disponibilidad; requisitos y proceso explicados sin recolectar antecedentes innecesarios de entrada. | Consulta → visita → postulación → contrato. |
| Tasación | Objetivo, cobertura, metodología, profesional, alcance, plazo y honorarios aprobados; diferencia entre avalúo fiscal y valor comercial. | Solicitud → alcance cotizado → encargo → informe entregado. |
| Captación de propietario | Qué servicio recibe, quién lo presta, precio sugerido y seguimiento; mandato/condiciones revisables. | Solicitud → contacto efectivo → propuesta → encargo. |

## Hoja de ruta

### 0–7 días: preparar el canal y la evidencia

1. Resolver dominio/hosting con su titular y verificar ruta pública indexable.
2. Aprobar contactos, identidad, cobertura, tarifas y alcance; designar responsable de respuesta.
3. Preparar privacidad/retención con revisión competente antes del 1 de diciembre; separar campos comerciales de notas internas.
4. Terminar la herramienta de fichas y pasar gate: acceso restringido, persistencia, separación cliente/interna, datos ausentes explícitos, impresión legible y sin filtración de notas privadas. Publicación y prueba final corresponden al equipo principal.
5. Reparar validaciones y foco, confirmar gate de publicación y registrar línea base de consultas.

### 8–30 días: consistencia y conversión

1. Revisar las fichas existentes contra fuentes: coordenadas/comuna, medidas, moneda y vigencia de datos. No recuperar decimales de memoria.
2. Optimizar imágenes y consultas relacionadas con medición antes/después.
3. Implementar consulta móvil contextual, captura de búsquedas sin resultados, recuperación de formulario y mapa en detalle.
4. Publicar responsables/metodología y 2–3 recursos locales originales; completar canonical, entidad y schema coherentes.
5. Probar recorridos con personas mayores y quienes usan teclado/zoom; corregir obstáculos observados.

### 31–90 días: aprender y ampliar con control

1. Comparar captación y tiempos por intención, comuna y canal; priorizar oferta donde exista atención sostenible.
2. Probar una mejora de conversión a la vez con eventos consistentes; evitar declarar victoria con muestras pequeñas.
3. Definir proceso de revisión periódica del inventario y de antecedentes de fichas; retirar disponibilidad vencida.
4. Considerar alertas de búsqueda, integraciones o paginación solo cuando el volumen y el proceso justifiquen su costo.
5. Revisar retención, permisos, fallos de entrega y gates en una cadencia estable.

## KPIs y cómo establecer una línea base

No se fijan valores actuales ni metas arbitrarias. Primero medir un periodo consistente y acordar objetivos según capacidad de atención. Evitar registrar mensajes privados, documentos o datos financieros en analítica.

| Indicador | Definición operativa | Fuente propuesta |
|---|---|---|
| Consulta por ficha | Solicitudes válidas asociadas a una ficha / vistas de esa ficha. Separar clic WhatsApp de conversación efectiva. | Visitas + solicitudes; confirmación manual/CRM para WhatsApp. |
| Contacto efectivo | Solicitudes con respuesta humana y canal confirmado / solicitudes válidas. | Panel/CRM con fecha y responsable. |
| Tiempo de primera respuesta | Mediana y percentil alto entre solicitud guardada y primera respuesta, según horario hábil acordado. | Marcas temporales del panel/CRM. |
| Visita coordinada | Solicitudes que alcanzan visita / consultas calificadas por intención. | Seguimiento comercial. |
| Oferta y cierre | Ofertas válidas / visitas; cierres / ofertas. Analizar compra y arriendo por separado. | CRM o registro comercial acordado. |
| Calidad del inventario | Fichas revisadas con campos esenciales y fuente/fecha / fichas activas. Separar completitud de verificación. | Lista de control editorial. |
| Uso de fichas técnicas | Fichas generadas y revisadas, incidencias de impresión, registros internos mostrados indebidamente (objetivo de diseño: cero exposición). | Eventos internos mínimos y QA. |
| Salud técnica | Errores por ruta, gate fallido, tiempos de respuesta y peso de imágenes; CWV de campo cuando haya datos. | Logs agregados, medición técnica y Search Console. |
| Salud orgánica | URLs canónicas indexables, cobertura de sitemap y consultas/clics por páginas locales. | Search Console tras conectar dominio. |

## Fuentes, pruebas y límites

Dictámenes base: [UX/conversión](audit-ux.md), [código/técnico](audit-tecnico.md), [SEO local/GEO/AEO](audit-seo.md). Cada uno conserva evidencia y límites específicos. La consolidación agrupa causas; no supone que una recomendación ya esté implementada.

- **F1 — BCN:** [Balance legislativo Ley 21.719](https://www.bcn.cl/balance-legislativo/detalle/ficha_LEY_21719_2024-12-13). Publicación de ley: 13-dic-2024; entrada en vigencia indicada: 01-dic-2026. Fecha verificada directamente para esta síntesis.
- **F2 — Banco Central:** [Serie mensual vivienda UF](https://si3.bcentral.cl/siete/ES/Siete/Cuadro/CAP_TASA_INTERES/MN_TASA_INTERES_09/TSF_27?idSerie=F022.VIV.TIP.MA03.UF.Z.M). Oct-2026: 4,10%; actualización 09-nov-2026 y alcance metodológico verificados directamente. No se usan observaciones posteriores al corte.
- **F3 — Banco Central:** [Encuesta bancaria, tercer trimestre 2026](https://www.bcentral.cl/contenido/-/details/prensa/nota-de-prensa/encuesta-de-credito-bancario-tercer-trimestre-2026). Página fechada 14-oct-2026; levantamiento 14–28-sep-2026. No es pronóstico de demanda de Cota Clara.
- **F4 — SII:** [Avalúo fiscal](https://www.sii.cl/destacados/impuesto_territorial/avaluo_fiscal.html).
- **F5 — ChileAtiende:** [Consulta de avalúos y certificados](https://www.chileatiende.gob.cl/fichas/3160-consul).
- **F6 — MINVU:** [Certificados y otros formularios](https://www.minvu.gob.cl/elementos-tecnicos/formularios/0-certificados-y-otros/).
- **F7 — CBR Santiago:** [Trámites de registros](https://www.conservador.cl/portal/tramites_registros). Es una referencia de trámites; cada inmueble requiere el conservador competente.

Se realizaron lecturas de código, HTTP público y DNS; consulta de documentación y páginas oficiales. El dictamen técnico informó cero vulnerabilidades conocidas en dependencias de producción según `npm audit --omit=dev` de esa ejecución, que no sustituye un pentest. No se hizo prueba de carga, auditoría legal, tasación, revisión de títulos, contacto con terceros, análisis de contratos, investigación de clientes ni prueba de campañas.

## Anexo: herramienta de fichas implementada

- Acceso desde **Panel → Fichas técnicas**, desde la lista de propiedades y desde el editor individual. Administradores y editores con contraseña vigente pueden usarla; las páginas y la API comprueban sesión.
- Incorpora automáticamente precio/moneda, superficies, distribución, descripción y fotografía del aviso. Agrega antecedentes SII, contribuciones, conservación, recepción, inscripción CBR y trazabilidad documental.
- «Revisados documentalmente» exige fuente, fecha válida y responsable. La herramienta no consulta ni certifica documentos de SII, DOM o CBR. Los campos ausentes se muestran como «No informado».
- La versión para clientes excluye las observaciones internas del documento. La interna las incorpora en un bloque identificado. La selección vuelve a cliente al recargar. Los borradores se identifican y no incluyen enlace público.
- Salida A4 mediante **Imprimir / guardar PDF** y vista previa con identidad Cota Clara. La descarga final se realiza eligiendo Guardar como PDF en el diálogo del navegador.
- Persistencia en tabla propia `propiedad_ficha`, migración aditiva e idempotente; registro de guardado en bitácora sin copiar las notas privadas.
- Validación: **229 pruebas en 18 archivos aprobadas**, TypeScript y compilación OpenNext/Cloudflare correctos. Prueba de navegador con usuario editor ficticio local: ingreso, selección, guardado, recarga, ambas versiones, impresión A4 y responsive a 390 px sin desborde horizontal. No se usaron cuentas ni antecedentes privados reales para esa prueba.
- La revisión final corrigió un caso de concurrencia: los campos quedan deshabilitados mientras se guarda para impedir que una edición posterior quede marcada como guardada sin estarlo.
- Publicación completada en [Acceso a fichas técnicas](https://cota-clara-web.franciscolabra87.workers.dev/panel/fichas), versión Cloudflare `d4d04229-c183-4220-86a3-cb6999d816c1`. Verificación posterior sin sesión: página redirige a `/acceso` (307), API rechaza guardado (401); portada responde 200 y conserva el mapa. El flujo autenticado se verificó localmente, sin intervenir cuentas reales de producción.

Guía operativa: [Cómo generar una ficha técnica](guia-fichas-tecnicas.md). La precisión de los datos heredados del inventario sigue siendo una tarea editorial pendiente; generar el documento no la certifica.

