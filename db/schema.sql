-- Esquema del acceso corporativo de Cota Clara (Cloudflare D1).
--
--   Local:  npm run db:local-schema
--   Remoto: npm run db:schema
--
-- Es la versión reducida del sistema de AG Casco Histórico: allá el padrón de
-- socios existe sin cuenta, así que `socios` y `usuarios` van separados. Acá
-- cada persona con acceso es una cuenta, y basta una tabla.

PRAGMA foreign_keys = ON;

-- Personas con acceso al panel. ADMIN gestiona usuarios; EDITOR no.
CREATE TABLE IF NOT EXISTS usuarios (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  rut_norm          TEXT NOT NULL UNIQUE,         -- sin puntos ni guion, en mayúsculas
  nombre            TEXT NOT NULL,
  email             TEXT,
  rol               TEXT NOT NULL CHECK(rol IN ('ADMIN','EDITOR')),
  password_hash     TEXT NOT NULL,                -- PBKDF2-SHA256, 100.000 iteraciones
  password_salt     TEXT NOT NULL,
  password_temporal INTEGER NOT NULL DEFAULT 1,   -- 1 = debe cambiarla al entrar
  intentos_fallidos INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta   TEXT,
  ultimo_login      TEXT,
  activo            INTEGER NOT NULL DEFAULT 1,
  creado_en         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sesiones activas. En la base se guarda solo el SHA-256 del token: si la
-- tabla se filtra, no se pueden secuestrar sesiones.
CREATE TABLE IF NOT EXISTS sesiones (
  token      TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  ip         TEXT,
  user_agent TEXT,
  creada_en  TEXT NOT NULL DEFAULT (datetime('now')),
  expira_en  TEXT NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_expira ON sesiones(expira_en);

-- Bitácora. El índice por (accion, ip, fecha) es el que usa el freno por IP
-- del login, que cuenta los LOGIN_FAIL recientes de una misma conexión.
CREATE TABLE IF NOT EXISTS log_eventos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  accion     TEXT NOT NULL,                       -- LOGIN_OK, LOGIN_FAIL, USUARIO_CREADO, ...
  detalle    TEXT,                                -- JSON
  ip         TEXT,
  fecha      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_log_fecha ON log_eventos(fecha);
CREATE INDEX IF NOT EXISTS idx_log_accion_ip_fecha ON log_eventos(accion, ip, fecha);

-- ─────────────────────────────────────────────────────────────────────
-- Inventario de propiedades (etapa 2 del panel)
-- ─────────────────────────────────────────────────────────────────────

-- Los campos que en TypeScript eran arreglos (etiquetas, descripción,
-- características) se guardan como JSON en TEXT: son listas cortas de texto
-- que nunca se consultan por elemento, así que una tabla aparte solo
-- complicaría las lecturas.
CREATE TABLE IF NOT EXISTS propiedades (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  slug             TEXT NOT NULL UNIQUE,
  titulo           TEXT NOT NULL DEFAULT '',
  tipo             TEXT NOT NULL CHECK(tipo IN ('departamento','casa','oficina')),
  operacion        TEXT NOT NULL CHECK(operacion IN ('venta','arriendo')),
  comuna           TEXT NOT NULL,
  sector           TEXT NOT NULL DEFAULT '',
  latitud          REAL,
  longitud         REAL,
  precio_valor     INTEGER NOT NULL,
  precio_moneda    TEXT NOT NULL CHECK(precio_moneda IN ('UF','CLP')),
  precio_periodo   TEXT,                                  -- 'mes' en arriendo
  dormitorios      INTEGER NOT NULL DEFAULT 0,
  banos            INTEGER NOT NULL DEFAULT 0,
  estacionamientos INTEGER NOT NULL DEFAULT 0,
  bodegas          INTEGER NOT NULL DEFAULT 0,
  superficie_util  INTEGER NOT NULL DEFAULT 0,
  superficie_total INTEGER NOT NULL DEFAULT 0,
  terreno          INTEGER,
  -- Medidas del terreno en metros, con decimales. Van aparte de los m2 porque
  -- no se deducen de ellos: 300 m2 pueden ser 10 x 30 o 15 x 20.
  frente           REAL,
  fondo            REAL,
  piso             INTEGER,
  orientacion      TEXT NOT NULL DEFAULT '',
  anio             INTEGER NOT NULL DEFAULT 0,
  gastos_comunes   INTEGER,
  etiquetas        TEXT NOT NULL DEFAULT '[]',            -- JSON
  resumen          TEXT NOT NULL DEFAULT '',
  descripcion      TEXT NOT NULL DEFAULT '[]',            -- JSON, un párrafo por elemento
  caracteristicas  TEXT NOT NULL DEFAULT '[]',            -- JSON
  destacada        INTEGER NOT NULL DEFAULT 0,
  publicada        TEXT NOT NULL,                         -- fecha YYYY-MM-DD
  -- BORRADOR no aparece en el sitio público: permite dejar una ficha a medias.
  estado           TEXT NOT NULL DEFAULT 'BORRADOR' CHECK(estado IN ('BORRADOR','PUBLICADA')),
  -- nuevo = Proyectos de inversión, usado = Retail. Cada segmento tiene su página.
  condicion        TEXT NOT NULL DEFAULT 'usado' CHECK(condicion IN ('nuevo','usado')),
  -- Ilustración SVG de reemplazo mientras la propiedad no tenga fotos.
  ilustracion_seed INTEGER NOT NULL DEFAULT 1,
  ilustracion_tono TEXT NOT NULL DEFAULT 'dia' CHECK(ilustracion_tono IN ('dia','atardecer')),
  creado_en        TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_propiedades_estado ON propiedades(estado, publicada DESC);
CREATE INDEX IF NOT EXISTS idx_propiedades_destacada ON propiedades(estado, destacada);
CREATE INDEX IF NOT EXISTS idx_propiedades_condicion ON propiedades(estado, condicion, publicada DESC);

-- Fotos en R2. En la base va solo la clave del objeto; los bytes nunca pasan
-- por acá y se sirven por /fotos/.
CREATE TABLE IF NOT EXISTS propiedad_fotos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  propiedad_id INTEGER NOT NULL,
  clave        TEXT NOT NULL UNIQUE,
  alt          TEXT NOT NULL DEFAULT '',
  orden        INTEGER NOT NULL DEFAULT 0,
  creada_en    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (propiedad_id) REFERENCES propiedades(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fotos_propiedad ON propiedad_fotos(propiedad_id, orden);

-- Solicitudes que llegan por los formularios del sitio. Se guardan antes de
-- intentar el correo. El correo es solo el aviso y esta tabla es el registro,
-- así una solicitud no se pierde aunque el envío falle o no esté configurado.
-- La ip sirve para frenar a quien manda muchas seguidas y se borra con la fila.
CREATE TABLE IF NOT EXISTS solicitudes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  variante  TEXT NOT NULL DEFAULT 'contacto' CHECK(variante IN ('contacto','tasacion','visita')),
  nombre    TEXT NOT NULL,
  email     TEXT NOT NULL,
  telefono  TEXT NOT NULL DEFAULT '',
  tipo      TEXT NOT NULL DEFAULT '',
  comuna    TEXT NOT NULL DEFAULT '',
  motivo    TEXT NOT NULL DEFAULT '',
  fecha     TEXT NOT NULL DEFAULT '',
  mensaje   TEXT NOT NULL DEFAULT '',
  propiedad TEXT NOT NULL DEFAULT '',
  correo    TEXT NOT NULL DEFAULT 'pendiente' CHECK(correo IN ('pendiente','enviado','sin-configurar','error')),
  estado    TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','enviando','error','respondida')),
  respuesta_texto TEXT NOT NULL DEFAULT '',
  nota_respuesta TEXT NOT NULL DEFAULT '',
  respuesta_clave TEXT,
  respuesta_email_id TEXT,
  respuesta_intentada_en TEXT,
  respondida_en TEXT,
  respondida_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ip        TEXT,
  creada_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_solicitudes_creada ON solicitudes(creada_en);
CREATE INDEX IF NOT EXISTS idx_solicitudes_ip ON solicitudes(ip, creada_en);

-- Visitas a las fichas públicas, sumadas por día. Una fila por propiedad y
-- por día, no una por visita: así la tabla crece con el calendario y no con
-- el tráfico, y no guarda nada de quién visitó.
CREATE TABLE IF NOT EXISTS propiedad_visitas (
  propiedad_id INTEGER NOT NULL,
  dia          TEXT NOT NULL,                   -- YYYY-MM-DD en hora de Chile
  total        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (propiedad_id, dia),
  FOREIGN KEY (propiedad_id) REFERENCES propiedades(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_visitas_dia ON propiedad_visitas(dia);

-- Antecedentes técnicos de cada propiedad, para la ficha técnica que se genera
-- desde el panel. Van en su propia tabla y no en propiedades a propósito: el
-- sitio público nunca lee esta tabla, así que nada de acá (el rol, el avalúo,
-- las observaciones internas) puede salir en una página pública por descuido.
CREATE TABLE IF NOT EXISTS propiedad_ficha (
  propiedad_id   INTEGER PRIMARY KEY,
  datos          TEXT NOT NULL DEFAULT '{}',
  actualizada_en TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (propiedad_id) REFERENCES propiedades(id) ON DELETE CASCADE
);

-- Drive interno: fotos, videos y documentos del equipo, en R2 bajo el
-- prefijo drive/. Cada usuario sube a su carpeta y todos ven todas.
-- La fila se crea al empezar la subida (estado 'subiendo') con el tamaño
-- declarado: así la cuota cuenta también lo que se está subiendo y dos
-- subidas en paralelo no pueden pasarse del límite entre las dos.
CREATE TABLE IF NOT EXISTS drive_archivos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,                           -- dueño: su carpeta
  clave      TEXT NOT NULL UNIQUE,              -- objeto en R2
  nombre     TEXT NOT NULL,                     -- nombre original, con la ruta si vino de una carpeta
  tipo       TEXT NOT NULL,                     -- Content-Type fijado por el servidor según la extensión
  tamano     INTEGER NOT NULL,
  estado     TEXT NOT NULL DEFAULT 'subiendo' CHECK(estado IN ('subiendo','listo')),
  upload_id  TEXT,                              -- id de la subida por partes de R2, mientras dura
  creado_en  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_drive_usuario ON drive_archivos(usuario_id, estado, creado_en);
CREATE INDEX IF NOT EXISTS idx_drive_estado ON drive_archivos(estado, creado_en);

-- CRM del panel: interesados de cada propiedad y su historial de llamadas,
-- visitas físicas, mensajes, notas y cambios de etapa.
CREATE TABLE IF NOT EXISTS crm_interesados (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  propiedad_id   INTEGER NOT NULL,
  nombre         TEXT NOT NULL,
  telefono       TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',
  etapa          TEXT NOT NULL DEFAULT 'nuevo'
                 CHECK(etapa IN ('nuevo','contactado','agendada','visito','negociacion','cerrado','descartado')),
  origen         TEXT NOT NULL DEFAULT 'manual' CHECK(origen IN ('manual','formulario')),
  solicitud_id   INTEGER UNIQUE,                -- la solicitud del sitio que lo creó, si vino del formulario
  creado_por     INTEGER,
  creado_en      TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (propiedad_id) REFERENCES propiedades(id) ON DELETE CASCADE,
  FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE SET NULL,
  FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_crm_interesados_propiedad ON crm_interesados(propiedad_id, etapa);

CREATE TABLE IF NOT EXISTS crm_actividades (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  interesado_id INTEGER NOT NULL,
  tipo          TEXT NOT NULL CHECK(tipo IN ('llamada','visita','mensaje','nota','etapa')),
  detalle       TEXT NOT NULL DEFAULT '',       -- lo que dijo el cliente; en 'etapa', la etapa nueva
  usuario_id    INTEGER,                        -- quién del equipo; NULL si la anotó el sitio
  fecha         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (interesado_id) REFERENCES crm_interesados(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_crm_actividades_interesado ON crm_actividades(interesado_id, fecha);
CREATE INDEX IF NOT EXISTS idx_crm_actividades_tipo ON crm_actividades(tipo, fecha);

-- Tareas del equipo, con responsable, fecha límite y enlace opcional a una
-- propiedad o a un interesado del CRM.
CREATE TABLE IF NOT EXISTS tareas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo         TEXT NOT NULL,
  detalle        TEXT NOT NULL DEFAULT '',
  estado         TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','en_curso','hecha')),
  responsable_id INTEGER,                       -- NULL: sin asignar
  vence_en       TEXT,                          -- fecha AAAA-MM-DD, opcional
  propiedad_id   INTEGER,
  interesado_id  INTEGER,
  creado_por     INTEGER,
  creado_en      TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  completada_en  TEXT,
  FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (propiedad_id) REFERENCES propiedades(id) ON DELETE SET NULL,
  FOREIGN KEY (interesado_id) REFERENCES crm_interesados(id) ON DELETE SET NULL,
  FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tareas_estado ON tareas(estado, vence_en);
CREATE INDEX IF NOT EXISTS idx_tareas_responsable ON tareas(responsable_id, estado);
CREATE INDEX IF NOT EXISTS idx_tareas_interesado ON tareas(interesado_id);
