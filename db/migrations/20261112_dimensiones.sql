-- Frente y fondo del terreno, en metros, para bases D1 que ya existen.
-- db/schema.sql ya los incluye para bases nuevas. Aplicar una sola vez y
-- antes de desplegar el código que los lee.
ALTER TABLE propiedades ADD COLUMN frente REAL;
ALTER TABLE propiedades ADD COLUMN fondo REAL;
