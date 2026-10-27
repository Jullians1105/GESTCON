-- Seguimiento de Nómina Electrónica — catálogo de empresas y estado mensual
-- Migración 045
--
-- Reemplaza el Excel "LISTADO NOMINAS ELECTRONICAS.xlsx" que llevaba una sola
-- persona. Cada empresa tiene un responsable propio (Grupo A, Grupo B, o quien
-- corresponda) y puede opcionalmente enlazarse a una empresa de Fondo
-- Emprender y/o de Empresas Externas — ese enlace es lo que permite que la
-- celda "Nómina electrónica" de esos dos seguimientos mensuales pase a
-- reflejar en vivo lo que se marque acá (ver fondoDetalleController.js,
-- fondoChecklistController.js y extChecklistController.js).

-- ── 1. Catálogo de empresas ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ne_empresas (
  id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  responsable_id    UUID         REFERENCES users(id)          ON DELETE SET NULL,
  fondo_empresa_id  UUID         REFERENCES fondo_empresas(id) ON DELETE SET NULL,
  ext_empresa_id    UUID         REFERENCES ext_empresas(id)   ON DELETE SET NULL,
  activa            BOOLEAN      NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ne_empresas_responsable ON ne_empresas(responsable_id);

-- Una empresa de Fondo Emprender o de Empresas Externas no puede quedar
-- enlazada dos veces (rompería la derivación: ¿cuál de las dos manda?).
CREATE UNIQUE INDEX idx_ne_empresas_fondo_unico ON ne_empresas(fondo_empresa_id) WHERE fondo_empresa_id IS NOT NULL;
CREATE UNIQUE INDEX idx_ne_empresas_ext_unico   ON ne_empresas(ext_empresa_id)   WHERE ext_empresa_id   IS NOT NULL;

CREATE TRIGGER ne_empresas_updated_at
  BEFORE UPDATE ON ne_empresas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 2. Estado mensual por empresa ──────────────────────────────────────────────
-- estado: 'pendiente' (rojo, ya se puede presentar y falta confirmar) es el
-- default — no hace falta insertar una fila para que una empresa se vea
-- pendiente en un mes vencido, el GET la sintetiza igual que en
-- ext_checklist_items. tiene_novedad/novedad_nota es un eje aparte (el "SI/NO"
-- que se anotaba al lado del nombre en el Excel, con el motivo en un
-- comentario) — no cambia el color del estado. nota es el motivo obligatorio
-- en UI cuando estado = 'no_aplica' (bloqueada, ya no se le hace, o no envía
-- información).

CREATE TABLE IF NOT EXISTS ne_meses (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id     UUID        NOT NULL REFERENCES ne_empresas(id) ON DELETE CASCADE,
  anio           SMALLINT    NOT NULL,
  mes            SMALLINT    NOT NULL CHECK (mes BETWEEN 1 AND 12),
  estado         VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente', 'presentada', 'no_aplica')),
  tiene_novedad  BOOLEAN     NOT NULL DEFAULT false,
  novedad_nota   TEXT,
  nota           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, anio, mes)
);

CREATE INDEX idx_ne_meses_anio_mes ON ne_meses(anio, mes);
CREATE INDEX idx_ne_meses_empresa  ON ne_meses(empresa_id);

CREATE TRIGGER ne_meses_updated_at
  BEFORE UPDATE ON ne_meses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 3. Semilla — listado vigente según docs/LISTADO NOMINAS ELECTRONICAS.xlsx ──
-- (hoja "N.E AGO 26", la más reciente al momento de esta migración). Solo se
-- importa el catálogo (empresa + enlaces); el histórico mes a mes del Excel
-- NO se migra — el seguimiento arranca limpio desde el mes vigente.
--
-- responsable_id queda deliberadamente NULL para las 109: en el Excel,
-- "GRUPO A"/"GRUPO B" identificaban de quién era el cliente en general, no
-- quién presenta la nómina electrónica — asignar eso quedó pendiente,
-- se hace luego a mano desde el catálogo (solo admin).
--
-- Los enlaces a fondo_empresa_id / ext_empresa_id se resolvieron por nombre
-- normalizado (mayúsculas, sin tildes/puntuación) contra los catálogos
-- existentes; lo que no cruzó queda sin enlazar.

INSERT INTO ne_empresas (name, fondo_empresa_id, ext_empresa_id) VALUES
  ('CENIT', NULL, NULL),
  ('COMETA', NULL, NULL),
  ('TULIPAN S.A.S', NULL, NULL),
  ('ROMERO S.A.S', NULL, NULL),
  ('CUMBRE', NULL, NULL),
  ('TOPACIO S.A.S', NULL, NULL),
  ('PRISMA S.A.S', NULL, NULL),
  ('HONDURA', NULL, NULL),
  ('COBRE', NULL, NULL),
  ('CORDILLERA', NULL, NULL),
  ('VISTAHERMOSA', NULL, (SELECT id FROM ext_empresas WHERE name = 'VISTAHERMOSA')),
  ('ZAFIRO', (SELECT id FROM fondo_empresas WHERE name = 'ZAFIRO'), NULL),
  ('GARDENIA', (SELECT id FROM fondo_empresas WHERE name = 'GARDENIA'), NULL),
  ('NEBLINA', (SELECT id FROM fondo_empresas WHERE name = 'NEBLINA'), NULL),
  ('CANELA', (SELECT id FROM fondo_empresas WHERE name = 'MONTANA'), NULL),
  ('ESPADANA', (SELECT id FROM fondo_empresas WHERE name = 'ESPADANA'), NULL),
  ('PRADERA', (SELECT id FROM fondo_empresas WHERE name = 'PRADERA'), NULL),
  ('AMATISTA', NULL, NULL),
  ('TRAPICHE', (SELECT id FROM fondo_empresas WHERE name = 'TRAPICHE'), NULL),
  ('ASOCIACION FENIX', (SELECT id FROM fondo_empresas WHERE name = 'ASOCIACION CAMINANTE'), NULL),
  ('ARCADIA', NULL, NULL),
  ('MORERA', (SELECT id FROM fondo_empresas WHERE name = 'MORERA'), NULL),
  ('ASOCIACION NOGAL', (SELECT id FROM fondo_empresas WHERE name = 'ASOCIACION NOGAL'), NULL),
  ('LAUREL', NULL, NULL),
  ('ARROYO', NULL, NULL),
  ('ALBORADA', (SELECT id FROM fondo_empresas WHERE name = 'ALBORADA'), NULL),
  ('ASOCIACION JUNCAL', NULL, NULL),
  ('ALTAMAR', (SELECT id FROM fondo_empresas WHERE name = 'ALTAMAR'), NULL),
  ('DAMASCO', NULL, NULL),
  ('ASOCIACION ANTURIO', NULL, NULL),
  ('ASOCIACION SALVIA', NULL, NULL),
  ('ASOCIACION ALTIPLANO', NULL, NULL),
  ('FORTUNA', (SELECT id FROM fondo_empresas WHERE name = 'FORTUNA'), NULL),
  ('ALMENDRO', (SELECT id FROM fondo_empresas WHERE name = 'BRUJULA S.A.S'), NULL),
  ('ESPUMA', (SELECT id FROM fondo_empresas WHERE name = 'ESPUMA'), NULL),
  ('VELERO', (SELECT id FROM fondo_empresas WHERE name = 'VELERO'), NULL),
  ('ASOCIACION PALOMA', (SELECT id FROM fondo_empresas WHERE name = 'ASOCIACION PALOMA'), NULL),
  ('ALTOZANO', (SELECT id FROM fondo_empresas WHERE name = 'PRIMAVERA'), NULL),
  ('LAGARTO', NULL, (SELECT id FROM ext_empresas WHERE name = 'LAGARTO')),
  ('ASOCIACION VIVERO', (SELECT id FROM fondo_empresas WHERE name = 'ASOCIACION VIVERO'), NULL),
  ('BANANAL', NULL, NULL),
  ('TERRAZA', (SELECT id FROM fondo_empresas WHERE name = 'TERRAZA'), NULL),
  ('VERBENA S.A.S', (SELECT id FROM fondo_empresas WHERE name = 'VERBENA S.A.S'), NULL),
  ('VINEDO', (SELECT id FROM fondo_empresas WHERE name = 'VINEDO'), NULL),
  ('JAZMIN S.A.S', (SELECT id FROM fondo_empresas WHERE name = 'GERANIO'), NULL),
  ('COLIBRI', (SELECT id FROM fondo_empresas WHERE name = 'COLIBRI'), NULL),
  ('COLINA', (SELECT id FROM fondo_empresas WHERE name = 'COLINA'), NULL),
  ('BARRANCO', (SELECT id FROM fondo_empresas WHERE name = 'BARRANCO'), NULL),
  ('HACIENDA', NULL, NULL),
  ('ROCIO', NULL, NULL),
  ('CHUSQUE', NULL, (SELECT id FROM ext_empresas WHERE name = 'GUACAMAYA S.A.S')),
  ('OLMO', NULL, NULL),
  ('FUENTE', NULL, NULL),
  ('BAHIA', NULL, (SELECT id FROM ext_empresas WHERE name = 'BAHIA')),
  ('LINDERO', NULL, NULL),
  ('ESPINEL', NULL, NULL),
  ('ARRAYAN S.A.S', NULL, NULL),
  ('ROBLEDAL', NULL, NULL),
  ('CABALLITO', NULL, NULL),
  ('LIBELULA', NULL, NULL),
  ('LUNARIA', NULL, NULL),
  ('GIRASOL', NULL, NULL),
  ('CRISANTEMO', NULL, NULL),
  ('MANANTIAL', (SELECT id FROM fondo_empresas WHERE name = 'MANANTIAL'), NULL),
  ('HELECHO', NULL, NULL),
  ('SEQUOIA', (SELECT id FROM fondo_empresas WHERE name = 'CENTAURO S.A.S'), NULL),
  ('ANCLA', (SELECT id FROM fondo_empresas WHERE name = 'VENADO'), NULL),
  ('PINAL', (SELECT id FROM fondo_empresas WHERE name = 'PETALO'), NULL),
  ('CAMELIA', NULL, NULL),
  ('JACARANDA', (SELECT id FROM fondo_empresas WHERE name = 'DEHESA S.A.S'), NULL),
  ('ASOCIACION LOMA', NULL, NULL),
  ('TIMBAL', (SELECT id FROM fondo_empresas WHERE name = 'TIMBAL'), NULL),
  ('RIBERA', (SELECT id FROM fondo_empresas WHERE name = 'DELFIN S.A.S'), NULL),
  ('ASOCIACION AZUCENA', NULL, NULL),
  ('CIRUELO', NULL, NULL),
  ('ASOCIACION JARDIN', (SELECT id FROM fondo_empresas WHERE name = 'ASOCIACION JARDIN'), NULL),
  ('GRANITO', NULL, NULL),
  ('NARANJO', (SELECT id FROM fondo_empresas WHERE name = 'GRANADA'), NULL),
  ('LEGADO S.A.S', NULL, NULL),
  ('FRESNO', (SELECT id FROM fondo_empresas WHERE name = 'FRESNO'), NULL),
  ('DUNA', NULL, NULL),
  ('ALELI S.A.S', (SELECT id FROM fondo_empresas WHERE name = 'MANGLAR'), NULL),
  ('JADE', NULL, NULL),
  ('MARIPOSA', (SELECT id FROM fondo_empresas WHERE name = 'VERGEL'), NULL),
  ('ESTRELLA', NULL, (SELECT id FROM ext_empresas WHERE name = 'ESTRELLA')),
  ('BALSAMO', NULL, NULL),
  ('MOLINO', NULL, NULL),
  ('CANDELARIA', NULL, (SELECT id FROM ext_empresas WHERE name = 'CANDELARIA')),
  ('OLIVO', NULL, (SELECT id FROM ext_empresas WHERE name = 'OLIVO')),
  ('ZORZAL', NULL, (SELECT id FROM ext_empresas WHERE name = 'ZORZAL')),
  ('GALEON', NULL, (SELECT id FROM ext_empresas WHERE name = 'VOLCAN')),
  ('TORREON', NULL, NULL),
  ('ORQUIDEA', NULL, (SELECT id FROM ext_empresas WHERE name = 'ORQUIDEA')),
  ('PAMPA', NULL, (SELECT id FROM ext_empresas WHERE name = 'PAMPA')),
  ('ASTROMELIA', NULL, (SELECT id FROM ext_empresas WHERE name = 'RAMADA')),
  ('TORRENTE', NULL, (SELECT id FROM ext_empresas WHERE name = 'TORRENTE')),
  ('PANAL', NULL, NULL),
  ('LADERA', NULL, NULL),
  ('CORAL', NULL, NULL),
  ('SOLANA', NULL, (SELECT id FROM ext_empresas WHERE name = 'GALAXIA S.A.S')),
  ('CENTELLA', NULL, (SELECT id FROM ext_empresas WHERE name = 'CENTELLA')),
  ('ELEGIA', NULL, NULL),
  ('GC', NULL, NULL),
  ('LAGUNA', NULL, NULL),
  ('MALVA', NULL, (SELECT id FROM ext_empresas WHERE name = 'NOGUERA S.A.S')),
  ('CAOBA', NULL, NULL),
  ('CASCADA', NULL, NULL),
  ('YARUMO', NULL, NULL),
  ('NIEBLA', NULL, NULL);
