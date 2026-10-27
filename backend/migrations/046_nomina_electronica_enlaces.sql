-- Nómina Electrónica — enlaces adicionales confirmados con el usuario
-- Migración 046
--
-- La migración 045 enlazó por coincidencia exacta/prefijo de nombre normalizado.
-- Estas son la misma empresa escrita distinto entre el Excel y los catálogos
-- de Fondo Emprender / Empresas Externas (typos, "Asociación"/"Granja"/etc. de
-- más, abreviaturas) — confirmado manualmente con el usuario, no por match
-- automático. Mismo patrón que 039_empresas_externas_responsables.sql: UPDATE
-- por nombre exacto, si alguno no existe en el entorno la fila simplemente no
-- se toca.

UPDATE ne_empresas SET ext_empresa_id = (SELECT id FROM ext_empresas WHERE name = 'GARZA')
WHERE name = 'MOLINO';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'MATORRAL')
WHERE name = 'AMATISTA';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'MIRLO')
WHERE name = 'DUNA';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'CORTIJO')
WHERE name = 'GIRASOL';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'NUBE')
WHERE name = 'LIBELULA';

UPDATE ne_empresas SET ext_empresa_id = (SELECT id FROM ext_empresas WHERE name = 'CEIBA')
WHERE name = 'TOPACIO S.A.S';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'ASOCIACION MIRADOR')
WHERE name = 'ASOCIACION LOMA';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'ASOCIACION CAMPANARIO')
WHERE name = 'ASOCIACION ANTURIO';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'OASIS')
WHERE name = 'HELECHO';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'ASOCIACION LLANURA')
WHERE name = 'ASOCIACION ALTIPLANO';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'ASOCIACION TEJAR')
WHERE name = 'ASOCIACION SALVIA';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'CHIRIMOYA')
WHERE name = 'CAMELIA';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'ASOCIACION MAREA')
WHERE name = 'GRANITO';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'AURORA')
WHERE name = 'JADE';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'FUNDACION ROSAL')
WHERE name = 'CIRUELO';

UPDATE ne_empresas SET ext_empresa_id = (SELECT id FROM ext_empresas WHERE name = 'MARGARITA')
WHERE name = 'ARCADIA';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'GAVIOTA')
WHERE name = 'LUNARIA';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'ASOCIACION MIEL')
WHERE name = 'LEGADO S.A.S';

UPDATE ne_empresas SET ext_empresa_id = (SELECT id FROM ext_empresas WHERE name = 'PASCUA')
WHERE name = 'DAMASCO';

UPDATE ne_empresas SET ext_empresa_id = (SELECT id FROM ext_empresas WHERE name = 'LIRIO')
WHERE name = 'YARUMO';

UPDATE ne_empresas SET fondo_empresa_id = (SELECT id FROM fondo_empresas WHERE name = 'ARBOLEDA')
WHERE name = 'CRISANTEMO';
