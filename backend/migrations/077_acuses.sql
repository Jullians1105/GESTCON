-- Acuses: seguimiento de la actualización de los acuses de recibo de las facturas electrónicas de cada cliente
-- (ver controllers/acusesController.js). Reemplaza el Excel "listadoAcuseActualizado" (3 listas: Contable,
-- Tributario y Externas) para que varias personas lo usen a la vez y quede quién lo hizo y cuándo.
-- Migración 077
--
-- Una fila por empresa y área. Los 3 eventos de cada empresa se hacen al mismo tiempo, así que se guarda UNA sola
-- fecha: "hasta qué día quedó actualizado". Si algo no se pudo hacer, queda dicho en la nota. `fondo` marca a las de Fondo Emprender («ACTUALES» en el Excel): se les hace el acuse ANTES porque
-- suelen comprar a crédito y, si después anulan una factura con acuse, ya no se puede.
-- `empresa_id` enlaza (opcional) con el Directorio; las que no están allí se llevan solo por nombre.
CREATE TABLE IF NOT EXISTS acuses_empresas (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  area       TEXT        NOT NULL CHECK (area IN ('contable', 'tributario', 'externas')),
  nombre     TEXT        NOT NULL,
  empresa_id UUID        REFERENCES empresas(id) ON DELETE SET NULL,
  fondo      BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Programa contable de las Externas (SIIGO, DATAICO, WORLD OFFICE…).
  programa   TEXT,
  estado     TEXT        NOT NULL DEFAULT 'pendiente'
             CHECK (estado IN ('pendiente', 'al_dia', 'con_pendientes', 'no_se_puede', 'no_hacer')),
  hasta      DATE,
  -- Algunas empresas solo se atienden hasta cierto mes («sep», «agosto»): al llegar ahí se quitan. Es el último día de ese mes;
  -- cuando `hasta` lo alcanza, la meta está cumplida y la empresa se puede quitar de la lista.
  hacer_hasta DATE,
  nota       TEXT,
  activa     BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (area, nombre)
);

CREATE INDEX IF NOT EXISTS idx_acuses_empresas_area ON acuses_empresas (area) WHERE activa;
CREATE INDEX IF NOT EXISTS idx_acuses_empresas_empresa ON acuses_empresas (empresa_id);
