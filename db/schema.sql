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
