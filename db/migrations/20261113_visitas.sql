-- Contador de visitas de las fichas, para bases D1 que ya existen.
-- db/schema.sql ya la incluye para bases nuevas. Es seguro repetirla.
-- Aplicar antes de desplegar el código: el panel lee esta tabla.
CREATE TABLE IF NOT EXISTS propiedad_visitas (
  propiedad_id INTEGER NOT NULL,
  dia          TEXT NOT NULL,
  total        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (propiedad_id, dia),
  FOREIGN KEY (propiedad_id) REFERENCES propiedades(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_visitas_dia ON propiedad_visitas(dia);
