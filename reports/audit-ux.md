# Dictamen independiente: UX, conversión y benchmark Chile

Fecha de revisión: 15 de noviembre de 2026. Marca: Cota Clara. Revisión del repositorio y páginas públicas. Este dictamen no modifica la aplicación.

## Veredicto

La base de experiencia es utilizable: existe catálogo filtrable, mapa con pins, fotos reales, formularios con errores asociados a sus campos, teléfono y WhatsApp contextual en cada ficha. La marca tiene un mensaje reconocible sobre decisiones respaldadas por datos. Las mayores oportunidades están en demostrar esa promesa, mantener la continuidad entre búsqueda y contacto, y confirmar las condiciones comerciales antes de atraer tráfico pagado. No se encontró evidencia de un P0 en esta revisión.

No asigno una nota de conversión ni una pérdida porcentual: no hay analítica del embudo ni pruebas de usuarios que permitan estimarlas.

## Hallazgos por prioridad

### UX-01 — P1 — Condiciones comerciales públicas con aprobación pendiente en el código

- **Evidencia:** `src/data/services.ts:17` dice «Los honorarios son referenciales: confirmar antes de publicar». El mismo archivo publica 2% + IVA y 50% de un canon mensual + IVA en líneas 43–44, y promete fotografía/plano, difusión y acompañamiento legal en líneas 27–33. HTTP 200 de `/servicios/corretaje` confirmó que esos porcentajes y la promesa legal llegan al sitio público.
- **Impacto:** un propietario puede iniciar una negociación esperando una tarifa y alcance concretos. Si el equipo opera de otra manera, la diferencia erosiona la confianza y genera consultas mal calificadas.
- **Recomendación:** validar con quien dirige la firma tarifa, base de cálculo, a quién se cobra, impuestos, servicio incluido y momento de pago; registrar fecha y responsable de aprobación. Si aún no están definidos, presentar una cotización por encargo y conservar solo las condiciones confirmadas. No copiar tarifas de competidores.
- **Incertidumbre:** el comentario puede estar desactualizado y la firma ya haber aprobado los valores. Confirmar esa aprobación; no afirmo que sean ilegales o incorrectos.

### UX-02 — P2 — La promesa de respaldo carece de evidencia humana visible

- **Evidencia:** portada `src/app/page.tsx:21–24,104–109` promete precisión, transparencia y experiencia. La tarjeta de agente solo identifica «Equipo Cota Clara» y un avatar CC (`src/app/propiedades/[slug]/page.tsx:225–231`). La sección contacto muestra marca y ubicación genérica de Providencia (`src/app/contacto/page.tsx:62–65`). El inventario de rutas no contiene una página de equipo o metodología publicada. `src/data/site.ts:8–13` concentra los contactos y una dirección genérica.
- **Impacto:** quien entrega una propiedad o solicita asesoría patrimonial no puede reconocer a la persona responsable ni evaluar fácilmente su experiencia. Esta carencia pesa más en una marca nueva y en clientes que llegan desde WhatsApp o una recomendación.
- **Recomendación:** publicar responsables reales con nombre, foto autorizada, función, experiencia comprobable, cobertura territorial y explicación concreta de la metodología. Añadir identidad comercial y canales confirmados en contacto. Usar testimonios únicamente con autorización y respaldo verificable. Confirmar que teléfono/correo publicados son operativos antes de campañas.
- **Incertidumbre:** no se llamó, envió correo ni abrió un mensaje de WhatsApp; el número publicado no se declara inválido por su apariencia. No se verificaron antecedentes profesionales externos.

### UX-03 — P2 — Tasaciones pide una comuna que no representa la cobertura del inventario

- **Evidencia:** `src/data/site.ts:24` contiene solo Providencia, Las Condes, Vitacura, Ñuñoa, La Reina y Lo Barnechea. `src/components/LeadForm.tsx:122–135` usa esa lista y una opción «Otra comuna». Sin embargo, portada `src/app/page.tsx:45–46` declara oferta en Metropolitana, Valparaíso y Coquimbo; catálogo y mapa extraen las comunas del inventario.
- **Impacto:** un propietario de Quilpué, Viña del Mar u Ovalle debe clasificarse como «Otra», aunque la firma ya ofrece propiedades allí. La solicitud pierde ubicación útil y el usuario puede dudar de la cobertura.
- **Recomendación:** alimentar el formulario con cobertura real aprobada, incluyendo las comunas del inventario, y permitir escribir la comuna cuando elija «Otra». Mantener separadas «dónde tenemos avisos» y «dónde prestamos tasaciones» si no coinciden.
- **Incertidumbre:** la cobertura de servicios necesita confirmación comercial; no debe ampliarse automáticamente solo porque exista un aviso.

### UX-04 — P2 — El estado sin resultados promete capturar una búsqueda, pero no ofrece la acción

- **Evidencia:** `src/components/PropertyExplorer.tsx:151–156` dice «déjanos tu búsqueda y te avisamos cuando aparezca una», pero la única acción es «Ver todas las propiedades». No hay enlace ni formulario para guardar esos filtros en ese bloque.
- **Impacto:** se pierde un contacto con intención concreta cuando el inventario no satisface su búsqueda; el visitante tiene que descubrir por su cuenta otro canal.
- **Recomendación:** añadir «Solicitar ayuda con esta búsqueda» que abra contacto con operación, comuna, tipo y presupuesto ya incorporados. Mantener «avisarte» solo si existe un proceso de seguimiento responsable, con consentimiento y capacidad real de cumplirlo.
- **Incertidumbre:** no se confirma un sistema de alertas fuera del sitio. La recomendación mínima puede ser una solicitud asistida, sin automatización.

### UX-05 — P2 — El mapa de portada y la ubicación de la ficha no mantienen la misma experiencia

- **Evidencia:** `src/app/page.tsx:62–74,317–321` entrega coordenadas y mapa real. En la ficha, `src/app/propiedades/[slug]/page.tsx:198–205` solo renderiza una ilustración referencial cuando `sector` tiene contenido; no usa `latitud/longitud`.
- **Impacto:** después de descubrir un pin y abrir su ficha, el comprador no puede examinar de nuevo esa ubicación desde el detalle. Algunas fichas muestran solo la comuna porque no tienen sector.
- **Recomendación:** usar el mismo punto aprobado en la ficha y ofrecer «Abrir en OpenStreetMap». Si se decide difuminar ubicaciones por seguridad o acuerdo con el propietario, etiquetar la precisión real y aplicar la misma regla en portada y detalle. No inventar cercanías a metro, colegios o servicios.
- **Incertidumbre:** no se evaluó en este dictamen si las coordenadas importadas señalan exactamente el inmueble o una zona referencial; es una validación editorial pendiente.

### UX-06 — P2 — En móvil, la llamada a visitar queda después de toda la descripción

- **Evidencia:** `src/app/propiedades/[slug]/page.tsx:217–247` coloca el formulario y los canales de agente después del contenido principal. La disposición pasa a una sola columna y deja de ser sticky en `src/styles/blocks/property.css:27–30`. El WhatsApp global (`src/components/WhatsAppButton.tsx:6`) usa un saludo genérico, mientras el canal del agente sí agrega la propiedad (`src/app/propiedades/[slug]/page.tsx:239`).
- **Impacto:** quien revisa muchas fotos y datos en celular puede no llegar al formulario. Si usa la burbuja global pierde el contexto del inmueble y debe volver a explicarlo.
- **Recomendación:** añadir una acción móvil «Consultar esta propiedad» junto al precio o una barra inferior compacta con WhatsApp contextual y «Solicitar visita». Evitar tapar atribuciones del mapa o controles; respetar safe area y objetivos táctiles amplios.
- **Incertidumbre:** la caída de conversión es una hipótesis de usabilidad; medir consultas iniciadas por ficha y revisar con usuarios antes de afirmar impacto cuantitativo.

### UX-07 — P2 — La navegación móvil no contiene ni restaura explícitamente el foco

- **Evidencia:** `src/components/Header.tsx:26–40` bloquea scroll, cierra con Escape y resize. El panel cerrado usa `inert`, pero el abierto no hace inerte el contenido de fondo, no implementa un ciclo de foco y no devuelve el foco al disparador al cerrar. No se encontró lógica de foco en el archivo.
- **Impacto:** un usuario de teclado puede avanzar a controles que quedan detrás del menú superpuesto, especialmente si usa teclado externo, navegación asistida o un lector de pantalla.
- **Recomendación:** definir el menú como navegación expandida o diálogo modal según la experiencia elegida. Para el panel de pantalla completa actual, gestionar foco inicial, mantenerlo dentro del panel y botón de cierre, bloquear el fondo y restaurarlo al disparador. Probar Tab/Shift+Tab/Escape y VoiceOver/TalkBack.
- **Incertidumbre:** hallazgo por inspección de código; no se realizó una prueba de lector de pantalla. La verificación visual de responsive corresponde a la revisión principal.

### UX-08 — P2 — Un fallo de formulario no ofrece continuidad inmediata

- **Evidencia:** `src/components/LeadForm.tsx:55–65` convierte cualquier respuesta no exitosa en el mismo estado de error. Las líneas 210–213 solo dicen «Inténtalo más tarde», aunque existen teléfono y WhatsApp disponibles en la marca. La confirmación siempre promete respuesta al próximo día hábil (`:74–75`).
- **Impacto:** una persona que ya escribió sus antecedentes puede abandonar la solicitud si no entiende si se guardó y qué canal usar; un adulto mayor necesita un siguiente paso claro.
- **Recomendación:** conservar lo ingresado, distinguir validación, límite temporal y fallo de conexión, y ofrecer «Llamar» o «Continuar por WhatsApp» con contexto mínimo y sin copiar datos privados automáticamente. Mostrar la promesa del día hábil solo si hay un responsable y seguimiento de SLA.
- **Incertidumbre:** no se enviaron formularios de producción ni se generaron solicitudes reales. El backend actual persiste solicitudes antes de avisar por correo; eso es una fortaleza y no debe confundirse con un error de entrega.

## Benchmark de capacidades observables en Chile

Revisión puntual de páginas oficiales al 15 de noviembre de 2026. Las ofertas descritas son lo que cada sitio presenta; no son una validación independiente de sus promesas ni de su desempeño comercial.

| Referente | Capacidad verificada | Aplicación proporcionada a Cota Clara |
|---|---|---|
| [TOCTOC](https://www.toctoc.com/) | Buscador por barrio/comuna/ciudad y código; entradas a tasación, financiamiento y subsidios; navegación territorial. | Facilitar reencontrar una ficha por código; mantener cobertura territorial clara; conectar contenido de valor con una acción concreta. |
| [Houm Chile](https://houm.com/cl) | Entradas diferenciadas para arrendar/comprar/invertir; en tarjetas expone canon y gastos comunes aproximados; muestra agentes/reseñas y explica etapas de su servicio. | Mostrar costo mensual cuando se conozca, reforzar identidad responsable y diferenciar la ruta de quien ofrece una propiedad de quien la busca. |
| [Fuenzalida Propiedades](https://fuenzalida.com/fuenzalida/) | Buscador con región/comuna/sector, búsqueda por código y mapa, sucursales y caminos separados para publicar, buscar y administrar. | Dar continuidad entre mapa y ficha, identificación territorial y captación de propietarios; no hace falta imitar el tamaño del portal. |
| [Capitalizarme, simulador](https://conoce.capitalizarme.com/simular-id25/) | Ruta guiada para estimar capacidad de inversión y explicar los pasos siguientes. | Explicar pie, dividendo y costos con supuestos transparentes. No solicitar antecedentes financieros sensibles en el primer contacto sin un propósito y protección definidos. |

La ventaja defendible para Cota Clara no está demostrada por añadir más filtros: debe materializar su promesa de precisión en fichas consistentes, datos con fecha y procedencia, personas responsables y seguimiento claro. Esta conclusión es una inferencia estratégica del contraste, no una métrica del mercado.

## Secuencia recomendada

1. **Antes de campañas:** aprobar tarifas/alcances, probar canales de contacto con el equipo y definir quién responde cada solicitud.
2. **Siguiente iteración:** corregir cobertura de tasación, capturar búsquedas sin resultados, conectar el mapa de detalle y dar una consulta contextual visible en móvil.
3. **Accesibilidad y soporte:** gestionar foco del menú, mejorar recuperación de errores y probar con personas que usan zoom, teclado o asistencia.
4. **Demostración de valor:** publicar responsables, metodología y un ejemplo de ficha técnica con datos reales autorizados. Separar hechos del inmueble, datos pendientes y antecedentes internos.
5. **Medición:** eventos de vista de ficha, filtros, consulta iniciada, solicitud guardada, visita coordinada y cierre. Relacionar solicitudes con propiedad/canal; establecer un periodo base antes de comparar cambios.

## Pruebas y límites

- Lectura de componentes/rutas/CSS citados e inventario de rutas.
- GET de portada y corretaje publicados: HTTP 200; confirmado contenido señalado. La herramienta web no logró abrir el dominio workers.dev; la lectura pública se contrastó con HTTP directo.
- Consulta de cuatro páginas oficiales de referentes; no se realizó compra, postulación ni contacto con terceros.
- No se operó el navegador compartido, no se enviaron mensajes, no se probaron llamadas, no se usaron sesiones privadas ni se midieron conversiones. Faltan pruebas con adultos mayores, lectores de pantalla y evidencia comercial aprobada.

