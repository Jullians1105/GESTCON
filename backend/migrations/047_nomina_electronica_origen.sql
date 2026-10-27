-- Nómina Electrónica — agrupación de origen (Grupo A / Grupo B / Externas)
-- Migración 047
--
-- El Excel llevaba tres bloques separados (columnas GRUPO A, GRUPO B, EXTERNAS)
-- y el usuario quiere seguir viendo esa agrupación en la grilla nueva. Es
-- DISTINTA de responsable_id (que sigue pendiente de asignar, ver migración
-- 045): responsable_id es quién presenta la nómina electrónica de esa
-- empresa; origen es solo de qué bloque del Excel venía, para poder agrupar
-- visualmente igual que antes. Texto libre en vez de FK — no referencia nada,
-- es una etiqueta.

ALTER TABLE ne_empresas ADD COLUMN origen VARCHAR(20)
  CHECK (origen IS NULL OR origen IN ('grupo_a', 'grupo_b', 'externas'));

-- GRUPO A (48)
UPDATE ne_empresas SET origen = 'grupo_a' WHERE name IN (
  'CENIT',
  'COMETA',
  'TULIPAN S.A.S',
  'ROMERO S.A.S',
  'CUMBRE',
  'TOPACIO S.A.S',
  'PRISMA S.A.S',
  'HONDURA',
  'COBRE',
  'CORDILLERA',
  'VISTAHERMOSA',
  'ZAFIRO',
  'GARDENIA',
  'NEBLINA',
  'CANELA',
  'ESPADANA',
  'PRADERA',
  'AMATISTA',
  'TRAPICHE',
  'ASOCIACION FENIX',
  'ARCADIA',
  'MORERA',
  'ASOCIACION NOGAL',
  'LAUREL',
  'ARROYO',
  'ALBORADA',
  'ASOCIACION JUNCAL',
  'ALTAMAR',
  'DAMASCO',
  'ASOCIACION ANTURIO',
  'ASOCIACION SALVIA',
  'ASOCIACION ALTIPLANO',
  'FORTUNA',
  'ALMENDRO',
  'ESPUMA',
  'VELERO',
  'ASOCIACION PALOMA',
  'ALTOZANO',
  'LAGARTO',
  'ASOCIACION VIVERO',
  'BANANAL',
  'TERRAZA',
  'VERBENA S.A.S',
  'VINEDO',
  'JAZMIN S.A.S',
  'COLIBRI',
  'COLINA',
  'BARRANCO'
);

-- GRUPO B (36)
UPDATE ne_empresas SET origen = 'grupo_b' WHERE name IN (
  'HACIENDA',
  'ROCIO',
  'CHUSQUE',
  'OLMO',
  'FUENTE',
  'BAHIA',
  'LINDERO',
  'ESPINEL',
  'ARRAYAN S.A.S',
  'ROBLEDAL',
  'CABALLITO',
  'LIBELULA',
  'LUNARIA',
  'GIRASOL',
  'CRISANTEMO',
  'MANANTIAL',
  'HELECHO',
  'SEQUOIA',
  'ANCLA',
  'PINAL',
  'CAMELIA',
  'JACARANDA',
  'ASOCIACION LOMA',
  'TIMBAL',
  'RIBERA',
  'ASOCIACION AZUCENA',
  'CIRUELO',
  'ASOCIACION JARDIN',
  'GRANITO',
  'NARANJO',
  'LEGADO S.A.S',
  'FRESNO',
  'DUNA',
  'ALELI S.A.S',
  'JADE',
  'MARIPOSA'
);

-- EXTERNAS (25)
UPDATE ne_empresas SET origen = 'externas' WHERE name IN (
  'ESTRELLA',
  'BALSAMO',
  'MOLINO',
  'CANDELARIA',
  'OLIVO',
  'ZORZAL',
  'GALEON',
  'TORREON',
  'ORQUIDEA',
  'PAMPA',
  'ASTROMELIA',
  'TORRENTE',
  'PANAL',
  'LADERA',
  'CORAL',
  'SOLANA',
  'CENTELLA',
  'ELEGIA',
  'GC',
  'LAGUNA',
  'MALVA',
  'CAOBA',
  'CASCADA',
  'YARUMO',
  'NIEBLA'
);
