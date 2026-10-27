-- Contabilidad — completa el NIT de las 52 empresas sembradas en la migración 051
-- Migración 052
--
-- El listado de origen (docs/LISTADO EMPRESAS.xlsx) no traía NIT, así que 051 las sembró
-- solo con el nombre. Estos NITs salen de docs/VENCIMIENTOS 2026.xlsx (columnas EMPRESA/NIT
-- de las hojas mensuales de retención), cruzados por nombre normalizado contra las 52
-- empresas: 45 coincidieron exacto, 7 por variantes obvias de la planilla (typos o razón
-- social con palabras de más, ej. "EMPRESA DEMO" → "EMPRESA DEMO", mismo NIT en 9 filas
-- de ese archivo). Sin conflictos: cada nombre mapeó a un único NIT en todas sus apariciones,
-- y no hay dos empresas de las 52 con el mismo NIT.
--
-- `AND nit IS NULL` en cada UPDATE es deliberado: si para cuando esto se despliegue ya se
-- completó algún NIT por uso real (primer reporte subido para esa empresa, ver
-- dianController.js#uploadDian), este seed no lo pisa — evita reintroducir un dato viejo
-- sobre uno más reciente y real.

UPDATE contab_empresas SET nit = '900000001' WHERE name = 'LAVANDA S.A.S' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000002' WHERE name = 'CIPRES S.A.S' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000003' WHERE name = 'CARACOL' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000004' WHERE name = 'TAMARINDO' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000005' WHERE name = 'CALIZA' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000006' WHERE name = 'ORIENTE' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000007' WHERE name = 'BELLOTA' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000008' WHERE name = 'CAFETAL' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000009' WHERE name = 'NENUFAR' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000010' WHERE name = 'DALIA' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000011' WHERE name = 'CERRITO' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000012' WHERE name = 'FLORESTA S.A.S' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000013' WHERE name = 'ROCIO' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000014' WHERE name = 'LUCIERNAGA' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000015' WHERE name = 'CEREZO' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000016' WHERE name = 'ROMERO S.A.S' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000017' WHERE name = 'TORREON' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000018' WHERE name = 'TRIGAL S.A.S' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000019' WHERE name = 'FUENTE' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000020' WHERE name = 'CORDILLERA' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000021' WHERE name = 'FUNDACION FRONDA' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000022' WHERE name = 'FUNDACION MARANON' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000023' WHERE name = 'AGUAMARINA S.A.S' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000024' WHERE name = 'ISLOTE' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000025' WHERE name = 'ALCAZAR' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000026' WHERE name = 'MAGNOLIA' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000027' WHERE name = 'LINDERO' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000028' WHERE name = 'CONDOR S.A.S' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000029' WHERE name = 'ELEGIA' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000030' WHERE name = 'ESPIGA' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000031' WHERE name = 'PENASCO' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000032'   WHERE name = 'TABACHIN' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000033' WHERE name = 'CARMESI S.A.S' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000034' WHERE name = 'CANAVERAL' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000035' WHERE name = 'PERGOLA' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000036' WHERE name = 'SAUCE' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000037' WHERE name = 'PERLA S.A.S' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000038' WHERE name = 'ARRAYAN S.A.S' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000039' WHERE name = 'PAJARITO' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000040' WHERE name = 'VALLECITO' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000041' WHERE name = 'BALSAMO' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000042' WHERE name = 'HORIZONTE S.A.S' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000043' WHERE name = 'CLAVEL' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000044'  WHERE name = 'AVENTURA' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000045' WHERE name = 'DORADA' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000046' WHERE name = 'PLEYADES S.A.S' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000047' WHERE name = 'CRISOL S.A.S' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000048' WHERE name = 'ARROYO' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000049' WHERE name = 'OBSIDIANA' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000050' WHERE name = 'UMBRAL' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000051' WHERE name = 'PARAMO' AND nit IS NULL;
UPDATE contab_empresas SET nit = '900000052' WHERE name = 'ACACIA' AND nit IS NULL;
