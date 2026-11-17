-- CRM del panel: los interesados de cada propiedad y su historial.
-- Un interesado es una tarjeta del kanban de esa propiedad; cada llamada,
-- visita física, mensaje, nota o cambio de etapa queda como una actividad.
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
