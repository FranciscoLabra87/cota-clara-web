-- Stock por unidades de los proyectos nuevos.
--
--   Local:  npx wrangler d1 execute cota-clara-db --local --persist-to .wrangler/state --file=db/migrations/20261120_unidades.sql
--   Remoto: npx wrangler d1 execute cota-clara-db --remote --file=db/migrations/20261120_unidades.sql
--
-- Un proyecto no es una fila nueva: es una propiedad con condicion = 'nuevo'.
-- Las tipologías y las unidades cuelgan de ella, así que slug, fotos, mapa,
-- CRM, visitas, fichas y SEO siguen funcionando sin tocarse.
--
-- El precio "desde" no lleva columna propia: se escribe en propiedades.precio_valor
-- con el mínimo de las unidades disponibles, que es lo que ya leen el listado,
-- las tarjetas, los filtros, el sitemap y los dos PDF.

PRAGMA foreign_keys = ON;

-- Las tipologías de un proyecto: el modelo de planta que se repite en varias
-- unidades (2D/2B, 3D/2B). Los m2 de la tipología son los del modelo; los de
-- cada unidad pueden diferir por piso o por terraza.
CREATE TABLE IF NOT EXISTS tipologias (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  propiedad_id       INTEGER NOT NULL,
  codigo             TEXT NOT NULL,                  -- '2D/2B'
  dormitorios        INTEGER NOT NULL DEFAULT 0,
  banos              INTEGER NOT NULL DEFAULT 0,
  superficie_util    REAL NOT NULL DEFAULT 0,
  superficie_terraza REAL NOT NULL DEFAULT 0,
  plano_clave        TEXT,                           -- objeto en R2, como las fotos
  orden              INTEGER NOT NULL DEFAULT 0,
  UNIQUE (propiedad_id, codigo),
  FOREIGN KEY (propiedad_id) REFERENCES propiedades(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tipologias_propiedad ON tipologias(propiedad_id, orden);

-- Una fila por unidad vendible. El numero es el que usa la inmobiliaria en su
-- planilla y es la clave con la que se vuelve a importar la misma unidad, así
-- que una carga repetida actualiza en vez de duplicar.
CREATE TABLE IF NOT EXISTS unidades (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  propiedad_id     INTEGER NOT NULL,
  tipologia_id     INTEGER,
  numero           TEXT NOT NULL,                    -- '302'
  piso             INTEGER,
  orientacion      TEXT NOT NULL DEFAULT '',
  superficie_util  REAL NOT NULL DEFAULT 0,
  superficie_total REAL NOT NULL DEFAULT 0,
  precio_uf        INTEGER NOT NULL,
  descuento_pct    REAL NOT NULL DEFAULT 0,
  estacionamientos INTEGER NOT NULL DEFAULT 0,
  bodegas          INTEGER NOT NULL DEFAULT 0,
  estado           TEXT NOT NULL DEFAULT 'disponible'
                   CHECK(estado IN ('disponible','reservada','vendida','bloqueada')),
  actualizado_en   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (propiedad_id, numero),
  FOREIGN KEY (propiedad_id) REFERENCES propiedades(id) ON DELETE CASCADE,
  FOREIGN KEY (tipologia_id) REFERENCES tipologias(id) ON DELETE SET NULL
);
-- El índice cubre las dos consultas que importan: el stock de un proyecto por
-- estado y el mínimo de precio de las disponibles.
CREATE INDEX IF NOT EXISTS idx_unidades_propiedad ON unidades(propiedad_id, estado, precio_uf);
CREATE INDEX IF NOT EXISTS idx_unidades_tipologia ON unidades(tipologia_id, estado);
