-- Deudas DIAN: último intento fallido sobre una revisión buena del mes. Un fallo (error/clave) NO pisa una
-- revisión buena del mismo mes, así que antes quedaba el resultado viejo sin ningún aviso de que el
-- reintento falló. Estas columnas guardan cuándo y por qué falló el último intento; se limpian cuando una
-- revisión buena nueva lo reemplaza.
-- Migración 075
ALTER TABLE dian_deudas_revisiones ADD COLUMN IF NOT EXISTS ultimo_fallo_at TIMESTAMPTZ;
ALTER TABLE dian_deudas_revisiones ADD COLUMN IF NOT EXISTS ultimo_fallo_mensaje TEXT;
