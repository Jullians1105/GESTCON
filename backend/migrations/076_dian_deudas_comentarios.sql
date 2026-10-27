-- Deudas DIAN: comentario por empresa y mes. Se guarda en su propia tabla (y no en la revisión) porque se puede
-- comentar una empresa que aún no tiene revisión ese mes. Al mes siguiente el comentario "se hereda": la
-- pantalla muestra el último de los meses anteriores hasta que alguien lo edite, lo elimine o escriba uno nuevo
-- (eso guarda una fila del mes en curso). Eliminar guarda un texto vacío, para que el anterior no reaparezca.
-- Migración 076
CREATE TABLE IF NOT EXISTS dian_deudas_comentarios (
  empresa_id UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  -- Primer día del mes (zona Bogotá), igual que dian_deudas_revisiones.mes.
  mes        DATE        NOT NULL,
  texto      TEXT        NOT NULL,
  updated_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (empresa_id, mes)
);
