-- Antecedentes técnicos de las propiedades, para bases D1 que ya existen.
-- db/schema.sql ya la incluye para bases nuevas. Es seguro repetirla.
-- Solo la lee el panel: aplicarla antes de desplegar evita un error al abrir
-- la ficha técnica, pero el sitio público no depende de ella.
CREATE TABLE IF NOT EXISTS propiedad_ficha (
  propiedad_id   INTEGER PRIMARY KEY,
  datos          TEXT NOT NULL DEFAULT '{}',
  actualizada_en TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (propiedad_id) REFERENCES propiedades(id) ON DELETE CASCADE
);
