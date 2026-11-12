import type { IconName } from '@/components/Icon';

export type Servicio = {
  slug: string;
  nombre: string;
  icono: IconName;
  resumen: string;
  titular: string;
  bajada: string;
  incluye: string[];
  pasos: { titulo: string; texto: string }[];
  honorarios: { concepto: string; detalle: string }[];
  preguntas: { pregunta: string; respuesta: string }[];
  formulario: 'tasacion' | 'contacto';
};

// Los honorarios son referenciales: confirmar antes de publicar.
export const servicios: Servicio[] = [
  {
    slug: 'corretaje',
    nombre: 'Corretaje',
    icono: 'key',
    resumen: 'Vendemos y arrendamos tu propiedad con una estrategia de precio basada en datos y reportes semanales.',
    titular: 'Vende o arrienda con una estrategia basada en evidencia',
    bajada:
      'Antes de publicar, entendemos el valor. Después definimos contigo el precio, la difusión y los plazos, y te mostramos cada semana qué está pasando.',
    incluye: [
      'Informe de valor antes de publicar',
      'Fotografía profesional y plano de la propiedad',
      'Difusión en portales y red de corredores',
      'Filtro de interesados y visitas acompañadas',
      'Reporte semanal: visitas, consultas, ofertas y recomendación',
      'Acompañamiento legal hasta la firma de la escritura',
    ],
    pasos: [
      { titulo: 'Diagnóstico', texto: 'Conversamos sobre tus objetivos y visitamos la propiedad.' },
      { titulo: 'Informe de valor', texto: 'Rango de precio, comparables y estrategia recomendada.' },
      { titulo: 'Publicación', texto: 'Fotos, plano, difusión y agenda de visitas.' },
      { titulo: 'Seguimiento', texto: 'Reporte semanal y ajustes con datos, no con intuición.' },
      { titulo: 'Cierre', texto: 'Negociación, promesa y escritura con respaldo legal.' },
    ],
    honorarios: [
      { concepto: 'Venta', detalle: '2% + IVA sobre el precio de venta' },
      { concepto: 'Arriendo', detalle: '50% de un canon mensual + IVA' },
    ],
    preguntas: [
      {
        pregunta: '¿Cuánto demora vender una propiedad?',
        respuesta:
          'Depende del precio, la zona y la demanda. En el informe de valor te entregamos un plazo esperado y lo revisamos cada semana con datos reales.',
      },
      {
        pregunta: '¿Qué pasa si no llegan ofertas?',
        respuesta:
          'El reporte semanal muestra visitas, consultas y comentarios. Con esa evidencia proponemos mantener, ajustar la presentación o revisar el precio, y te mostramos el impacto esperado.',
      },
      {
        pregunta: '¿Necesito exclusividad?',
        respuesta: 'Te recomendamos un mandato con plazo definido para invertir en difusión y fotografía, pero lo conversamos según tu caso.',
      },
    ],
    formulario: 'tasacion',
  },
  {
    slug: 'tasaciones',
    nombre: 'Tasaciones',
    icono: 'target',
    resumen: 'Informe de valor con comparables, rango de precio y recomendación, para vender, heredar o invertir.',
    titular: 'Conoce el valor real de tu propiedad',
    bajada:
      'Un informe que separa el valor de mercado, el precio de publicación recomendado y lo que todavía no sabemos. Con comparables reales y supuestos a la vista.',
    incluye: [
      'Visita técnica a la propiedad',
      'Comparables verificados, incluidos y descartados',
      'Rango de valor: bajo, base y alto',
      'Precio de publicación recomendado',
      'Supuestos, limitaciones y fecha de análisis',
      'Reunión para explicarte el informe',
    ],
    pasos: [
      { titulo: 'Solicitud', texto: 'Nos cuentas el motivo de la tasación y agendamos la visita.' },
      { titulo: 'Visita técnica', texto: 'Revisamos superficie, estado, terminaciones y entorno.' },
      { titulo: 'Análisis', texto: 'Comparamos operaciones reales y ajustamos por diferencias.' },
      { titulo: 'Entrega', texto: 'Te explicamos el rango y la recomendación en una reunión.' },
    ],
    honorarios: [
      { concepto: 'Informe de valor residencial', detalle: 'Tarifa fija según tipo y complejidad de la propiedad' },
      { concepto: 'Si nos encargas la venta', detalle: 'El valor del informe se descuenta de la comisión' },
    ],
    preguntas: [
      {
        pregunta: '¿El avalúo fiscal sirve como tasación?',
        respuesta:
          'No. El avalúo fiscal del SII tiene fines tributarios y no representa el valor comercial de la propiedad.',
      },
      {
        pregunta: '¿Para qué sirve el informe de valor?',
        respuesta: 'Para vender o comprar con una referencia sólida, para herencias y particiones, divorcios, inversiones o negociaciones.',
      },
      {
        pregunta: '¿Cuánto demora?',
        respuesta: 'Depende de la complejidad de la propiedad. Te confirmamos el plazo al agendar la visita.',
      },
    ],
    formulario: 'tasacion',
  },
  {
    slug: 'asesoria',
    nombre: 'Asesoría',
    icono: 'compass',
    resumen: 'Te acompañamos en compras, herencias e inversiones con un análisis independiente y claro.',
    titular: 'Decisiones inmobiliarias con respaldo',
    bajada:
      'Cuando la pregunta no es solo vender, te ayudamos a comparar escenarios: vender o arrendar, comprar o esperar, dividir o conservar.',
    incluye: [
      'Evaluación de compra: ¿el precio es razonable?',
      'Vender o arrendar: comparación de escenarios',
      'Herencias y particiones con valor de referencia independiente',
      'Inversión: rentabilidad, plusvalía y sensibilidad',
      'Revisión de títulos coordinada con abogados',
      'Representación del comprador en la negociación',
    ],
    pasos: [
      { titulo: 'Pregunta', texto: 'Definimos la decisión que necesitas tomar y su plazo.' },
      { titulo: 'Análisis', texto: 'Reunimos datos, comparables y escenarios.' },
      { titulo: 'Recomendación', texto: 'Te mostramos qué sabemos, qué no y qué conviene hacer.' },
      { titulo: 'Acompañamiento', texto: 'Te apoyamos en la ejecución, si lo necesitas.' },
    ],
    honorarios: [
      { concepto: 'Asesoría por proyecto', detalle: 'Tarifa fija acordada por escrito antes de empezar' },
      { concepto: 'Representación del comprador', detalle: 'Honorario separado, con contrato de representación' },
    ],
    preguntas: [
      {
        pregunta: '¿A quién representan si compro una propiedad que ustedes venden?',
        respuesta: 'Te lo decimos por escrito desde el principio. Si representamos al vendedor, te recomendamos una asesoría independiente.',
      },
      {
        pregunta: '¿Trabajan con abogados?',
        respuesta: 'Sí. Coordinamos la revisión de títulos y los documentos legales con abogados especialistas.',
      },
    ],
    formulario: 'contacto',
  },
  {
    slug: 'gestion-patrimonial',
    nombre: 'Gestión de Patrimonio',
    icono: 'building',
    resumen: 'Administramos tus propiedades en arriendo: arrendatarios, cobranza, mantención e informes mensuales.',
    titular: 'Tu propiedad en arriendo, bien administrada',
    bajada:
      'Nos hacemos cargo del día a día de tus arriendos y te entregamos cada mes un informe claro de ingresos, gastos y rentabilidad.',
    incluye: [
      'Búsqueda y evaluación de arrendatarios',
      'Contratos, garantías e inventario',
      'Cobranza y pago mensual al propietario',
      'Mantenciones y reparaciones coordinadas',
      'Inspecciones periódicas',
      'Informe mensual de rentabilidad',
    ],
    pasos: [
      { titulo: 'Evaluación', texto: 'Revisamos la propiedad y estimamos el canon de mercado.' },
      { titulo: 'Arriendo', texto: 'Publicamos, evaluamos interesados y firmamos el contrato.' },
      { titulo: 'Administración', texto: 'Cobranza, pagos, mantenciones y atención al arrendatario.' },
      { titulo: 'Informe', texto: 'Cada mes, ingresos, gastos y rentabilidad en un solo documento.' },
    ],
    honorarios: [
      { concepto: 'Administración', detalle: '6% a 9% + IVA mensual, según cobertura' },
      { concepto: 'Colocación del arrendatario', detalle: '50% de un canon mensual + IVA' },
    ],
    preguntas: [
      {
        pregunta: '¿Qué pasa si el arrendatario no paga?',
        respuesta: 'Activamos la cobranza de inmediato y te informamos de cada paso. Te explicamos las opciones de garantía antes de firmar el contrato.',
      },
      {
        pregunta: '¿Puedo administrar varias propiedades con ustedes?',
        respuesta: 'Sí. El informe mensual consolida todas tus propiedades en un solo documento.',
      },
    ],
    formulario: 'contacto',
  },
];

export const buscarServicio = (slug: string) => servicios.find((s) => s.slug === slug);
