-- Tareas del equipo: un kanban de Por hacer, En curso y Hecha. Cada tarea
-- puede tener responsable, fecha límite y quedar ligada a una propiedad o a
-- un interesado del CRM.
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
