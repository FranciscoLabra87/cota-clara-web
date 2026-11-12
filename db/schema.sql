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
  -- Ilustración SVG de reemplazo mientras la propiedad no tenga fotos.
  ilustracion_seed INTEGER NOT NULL DEFAULT 1,
  ilustracion_tono TEXT NOT NULL DEFAULT 'dia' CHECK(ilustracion_tono IN ('dia','atardecer')),
  creado_en        TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_propiedades_estado ON propiedades(estado, publicada DESC);
CREATE INDEX IF NOT EXISTS idx_propiedades_destacada ON propiedades(estado, destacada);

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
