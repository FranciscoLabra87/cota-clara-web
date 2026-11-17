-- Separa el inventario en Proyectos de inversión (nuevos) y Retail (usados).
-- Todo lo que ya existe queda como usado; los proyectos nuevos se marcan desde el panel.
ALTER TABLE propiedades ADD COLUMN condicion TEXT NOT NULL DEFAULT 'usado' CHECK(condicion IN ('nuevo','usado'));
CREATE INDEX IF NOT EXISTS idx_propiedades_condicion ON propiedades(estado, condicion, publicada DESC);
