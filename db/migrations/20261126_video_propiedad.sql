-- Un único video público por propiedad. El objeto vive en R2 bajo
-- videos-propiedades/{slug}/{hash12}.mp4 y se entrega por una ruta por slug.
ALTER TABLE propiedades ADD COLUMN video_clave TEXT;
