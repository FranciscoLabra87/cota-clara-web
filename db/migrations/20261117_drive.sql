-- Drive interno del equipo, para bases D1 que ya existen.
-- db/schema.sql ya la incluye para bases nuevas. Es seguro repetirla.
-- Solo la usa el panel: el sitio público no depende de ella.
CREATE TABLE IF NOT EXISTS drive_archivos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  clave      TEXT NOT NULL UNIQUE,
  nombre     TEXT NOT NULL,
  tipo       TEXT NOT NULL,
  tamano     INTEGER NOT NULL,
  estado     TEXT NOT NULL DEFAULT 'subiendo' CHECK(estado IN ('subiendo','listo')),
  upload_id  TEXT,
  creado_en  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_drive_usuario ON drive_archivos(usuario_id, estado, creado_en);
CREATE INDEX IF NOT EXISTS idx_drive_estado ON drive_archivos(estado, creado_en);
