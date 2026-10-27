-- Empresas Externas — columna "contador" (texto libre, no FK a users)
-- Migración 040
--
-- A diferencia de responsable_id (migración 038/039), contador no referencia
-- una cuenta del sistema: es solo la etiqueta con el nombre del contador a
-- cargo, tomada de docs/EMPRESAS.xlsx. Texto libre porque al menos un caso
-- real (una empresa) no tiene un único contador limpio: el Excel trae
-- dos filas con contadores distintos para esa empresa, así que se guarda
-- como "Contador A/Contador C" — un valor que no tendría sentido forzar a un FK.

ALTER TABLE ext_empresas ADD COLUMN contador VARCHAR(255);

UPDATE ext_empresas SET contador = 'Contador C'
WHERE name IN (
  'AMANECER', 'VIOLETA', 'ESTRELLA', 'BARLOVENTO',
  'LIRIO', 'RAMADA',
  'CANDELARIA', 'BERGANTIN', 'PEDREGAL S.A.S', 'TORRENTE',
  'GALAXIA S.A.S', 'ATARDECER', 'PAMPA', 'CENTELLA',
  'GARZA', 'OLIVO', 'ORQUIDEA', 'EDEN',
  'VOLCAN', 'PINAR', 'NOGUERA S.A.S'
);

UPDATE ext_empresas SET contador = 'Contador A'
WHERE name IN (
  'HORNERO', 'GUAYABO', 'SIEMBRA',
  'PASCUA', 'MARGARITA',
  'ESMERALDA', 'MADRESELVA', 'LAGARTO',
  'CEIBA'
);

UPDATE ext_empresas SET contador = 'Contador B'
WHERE name IN (
  'GUACAMAYA S.A.S', 'BAHIA', 'ZORZAL', 'ARENAL'
);

-- Caso ambiguo del Excel: dos filas para la misma empresa con contador distinto.
UPDATE ext_empresas SET contador = 'Contador A/Contador C'
WHERE name = 'VISTAHERMOSA';
