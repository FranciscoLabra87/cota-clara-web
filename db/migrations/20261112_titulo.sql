-- Añade el título propio del aviso a bases D1 existentes.
-- Ejecutar una sola vez; db/schema.sql ya lo incluye para bases nuevas.
ALTER TABLE propiedades ADD COLUMN titulo TEXT NOT NULL DEFAULT '';
