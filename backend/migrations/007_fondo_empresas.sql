-- Fondo Emprender — catálogo de empresas
-- Migración 007

CREATE TABLE IF NOT EXISTS fondo_empresas (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(255) NOT NULL,
  categoria  VARCHAR(20)  NOT NULL DEFAULT 'contable'
             CHECK (categoria IN ('contable', 'tributario')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fondo_empresas_categoria ON fondo_empresas(categoria);

CREATE TRIGGER fondo_empresas_updated_at
  BEFORE UPDATE ON fondo_empresas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO fondo_empresas (name, categoria) VALUES
  ('CORALINA',                  'contable'),
  ('IRIS',                    'contable'),
  ('CASTANO',                          'contable'),
  ('ENCINA',                       'contable'),
  ('NACAR',            'contable'),
  ('ASOCIACION RIACHUELO',               'contable'),
  ('ASOCIACION CUARZO',                   'contable'),
  ('CEDRO S.A.S',         'contable'),
  ('REMANSO S.A.S',                   'contable'),
  ('ESMERIL',                    'contable'),
  ('GUADUA',                      'contable'),
  ('ORILLA',                'contable'),
  ('BALCON',                  'contable'),
  ('ASOCIACION CARDON',               'contable'),
  ('FARO S.A.S',                        'contable'),
  ('SABANA',                    'contable'),
  ('FUNDACION SENDERO',                       'contable'),
  ('ASOCIACION FRAMBUESA',                    'contable'),
  ('ASOCIACION GLICINIA',                  'contable'),
  ('ASOCIACION OCASO',                'contable'),
  ('ASOCIACION EBANO',                 'contable'),
  ('CUCARACHERO',                  'contable'),
  ('TERRON',                    'contable'),
  ('BEGONIA',                              'tributario'),
  ('ZARZAL',                           'tributario'),
  ('PENON',                       'tributario'),
  ('CACTUS',                     'tributario'),
  ('BUGAMBILIA',                    'tributario'),
  ('MONTERA',                         'tributario'),
  ('MADRIGAL',                'tributario');
