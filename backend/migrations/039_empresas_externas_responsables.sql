-- Empresas Externas — asignar responsable inicial según docs/EMPRESAS.xlsx
-- Migración 039
--
-- Se vincula por NOMBRE (ILIKE 'Nombre%'), no por un UUID fijo: el Excel solo
-- trae el primer nombre (USUARIO DEMO, USUARIO DEMO, USUARIO DEMO, USUARIO DEMO) y la cuenta real de
-- cada persona puede tener un id distinto en cada entorno. Si no existe
-- ningún usuario con ese nombre en la base donde corre esta migración, la
-- subconsulta devuelve NULL y la empresa simplemente queda sin responsable
-- asignado — no falla, y se puede asignar luego a mano desde la grilla.

UPDATE ext_empresas SET responsable_id = (SELECT id FROM users WHERE name ILIKE 'Usuario Demo 2%' LIMIT 1)
WHERE name IN (
  'AMANECER', 'VIOLETA', 'BERGANTIN', 'PEDREGAL S.A.S',
  'TORRENTE', 'GALAXIA S.A.S', 'ATARDECER', 'CENTELLA',
  'ZORZAL', 'OLIVO', 'PINAR'
);

UPDATE ext_empresas SET responsable_id = (SELECT id FROM users WHERE name ILIKE 'Usuario Demo 4%' LIMIT 1)
WHERE name IN (
  'ESTRELLA', 'BARLOVENTO', 'LIRIO',
  'RAMADA', 'CANDELARIA', 'GUACAMAYA S.A.S', 'BAHIA',
  'PASCUA', 'PAMPA', 'LAGARTO', 'GARZA',
  'ORQUIDEA', 'ARENAL', 'CEIBA', 'VOLCAN',
  'NOGUERA S.A.S'
);

UPDATE ext_empresas SET responsable_id = (SELECT id FROM users WHERE name ILIKE 'Usuario Demo 3%' LIMIT 1)
WHERE name IN (
  'HORNERO', 'GUAYABO', 'SIEMBRA', 'MARGARITA',
  'ESMERALDA', 'MADRESELVA', 'VISTAHERMOSA'
);

UPDATE ext_empresas SET responsable_id = (SELECT id FROM users WHERE name ILIKE 'Usuario Demo 1%' LIMIT 1)
WHERE name IN ('EDEN');
