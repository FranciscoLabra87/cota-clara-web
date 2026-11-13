-- Tabla de solicitudes de los formularios, para bases D1 que ya existen.
-- db/schema.sql ya la incluye para bases nuevas. Es seguro repetirla.
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
  ip        TEXT,
  creada_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_solicitudes_creada ON solicitudes(creada_en);
CREATE INDEX IF NOT EXISTS idx_solicitudes_ip ON solicitudes(ip, creada_en);
