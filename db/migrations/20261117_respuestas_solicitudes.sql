-- Respuestas enviadas desde el panel. El aviso interno `correo` sigue separado.
ALTER TABLE solicitudes ADD COLUMN estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','enviando','error','respondida'));
ALTER TABLE solicitudes ADD COLUMN respuesta_texto TEXT NOT NULL DEFAULT '';
ALTER TABLE solicitudes ADD COLUMN nota_respuesta TEXT NOT NULL DEFAULT '';
ALTER TABLE solicitudes ADD COLUMN respuesta_clave TEXT;
ALTER TABLE solicitudes ADD COLUMN respuesta_email_id TEXT;
ALTER TABLE solicitudes ADD COLUMN respuesta_intentada_en TEXT;
ALTER TABLE solicitudes ADD COLUMN respondida_en TEXT;
ALTER TABLE solicitudes ADD COLUMN respondida_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
