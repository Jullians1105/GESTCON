-- Deudas DIAN: "chulito" de revisada. En el Excel de DEUDAS VENCIDAS DIAN se marcaba cada empresa apenas se
-- revisaba, se actualizaba el Excel y se enviaba el correo. Va en la revisión del mes (una por empresa y
-- mes), así que cada mes arranca sin marcar. Es independiente de `correo_enviado_at` (que solo aplica a
-- empresas con deuda): el chulito también se pone a las que están al día.
-- Migración 074
ALTER TABLE dian_deudas_revisiones ADD COLUMN IF NOT EXISTS marcada_revisada_at TIMESTAMPTZ;
ALTER TABLE dian_deudas_revisiones ADD COLUMN IF NOT EXISTS marcada_revisada_por UUID REFERENCES users(id) ON DELETE SET NULL;
