-- Coordenadas del iframe de Google Maps publicado en cada ficha de origen.
-- Aplicar una sola vez a bases D1 existentes, antes de desplegar el mapa.
-- db/schema.sql ya incluye las columnas para bases nuevas.
ALTER TABLE propiedades ADD COLUMN latitud REAL;
ALTER TABLE propiedades ADD COLUMN longitud REAL;

-- Conserva coordenadas que se hayan editado a mano desde el panel.
UPDATE propiedades SET latitud = -33.51055830, longitud = -70.64849200 WHERE slug = '200819-varas-mena-san-miguel' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -33.50890110, longitud = -70.60104580 WHERE slug = '201517-departamental-macul' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -33.44243840, longitud = -70.64307350 WHERE slug = '201520-oficina-diagonal-paraguay' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -33.44494350, longitud = -70.52670660 WHERE slug = '201522-la-reina-alta-casa' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -33.53668080, longitud = -70.56921970 WHERE slug = '201525-cipres-cordillerano-la-florida' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -30.60845880, longitud = -71.20946680 WHERE slug = '201540-irma-alcayaga-cortes-ovalle' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -30.60765960, longitud = -71.21090850 WHERE slug = '201541-los-ciruelos-orientes-ovalle' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -30.60308190, longitud = -71.20298940 WHERE slug = '201543-los-jacaranda-ovalle' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -30.60797620, longitud = -71.20978870 WHERE slug = '201545-pedro-barrios-ovalle' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -33.42906250, longitud = -70.60802330 WHERE slug = '201604-galvarino-gallardo-providencia' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -33.46647680, longitud = -70.52735840 WHERE slug = '201700-jose-arrieta-penalolen' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -33.49625500, longitud = -70.61662470 WHERE slug = '201704-vicuna-mackenna-metro-rodrigo-de-araya' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -33.45601100, longitud = -70.69454650 WHERE slug = '201760-proyecto-eco-estacion' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -33.03716940, longitud = -71.42760630 WHERE slug = '202036-hermosa-casa-sector-del-sol-quilpue' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -33.02790910, longitud = -71.56898880 WHERE slug = '202038-casa-residencial-vina-del-mar' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -32.94995830, longitud = -71.53942960 WHERE slug = '202039-departamento-con-con' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -33.05041930, longitud = -71.34370210 WHERE slug = '202040-hermosa-casa-pena-blanca' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -33.07428172, longitud = -71.41387939 WHERE slug = '202043-hermosa-casa-teniente-serrano-quilpue' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -33.06452900, longitud = -71.43510590 WHERE slug = '202053-departamento-los-pinos-quilpue' AND latitud IS NULL AND longitud IS NULL;
UPDATE propiedades SET latitud = -32.99500040, longitud = -71.51587440 WHERE slug = '202057-departamento-mesa-de-aragon-vina' AND latitud IS NULL AND longitud IS NULL;
