// Acuses: seguimiento de hasta qué día quedaron actualizados los acuses de recibo de cada cliente (migración 077).
// Lectura abierta a cualquier autenticado; editar, a quien pueda editar (no viewer).
const db = require('../config/database');
const auditLog = require('../utils/auditLog');

const AREAS = ['contable', 'tributario', 'externas'];
const ESTADOS = ['pendiente', 'al_dia', 'con_pendientes', 'no_se_puede', 'no_hacer'];

const fila = (f) => ({
  id: f.id,
  area: f.area,
  nombre: f.nombre,
  empresaId: f.empresa_id,
  empresaNombre: f.empresa_nombre ?? null,
  fondo: f.fondo,
  programa: f.programa,
  estado: f.estado,
  hasta: f.hasta,
  hacerHasta: f.hacer_hasta,
  nota: f.nota,
  actualizadoPor: f.actualizado_por ?? null,
  actualizadoAt: f.updated_at,
});

const SELECT = `
  SELECT a.id, a.area, a.nombre, a.empresa_id, e.name AS empresa_nombre, a.fondo, a.programa, a.estado,
         to_char(a.hasta, 'YYYY-MM-DD') AS hasta, to_char(a.hacer_hasta, 'YYYY-MM-DD') AS hacer_hasta, a.nota, a.updated_at, u.name AS actualizado_por
  FROM acuses_empresas a
  LEFT JOIN empresas e ON e.id = a.empresa_id
  LEFT JOIN users u ON u.id = a.updated_by`;

// Todas las empresas activas de las 3 áreas.
const listar = async (_req, res, next) => {
  try {
    const { rows } = await db.query(`${SELECT} WHERE a.activa ORDER BY a.nombre`);
    res.json({ empresas: rows.map(fila) });
  } catch (err) {
    next(err);
  }
};

// Columnas editables en una fila existente: lo que no viene en el cuerpo no se toca.
const CAMPOS = {
  nombre: 'nombre', fondo: 'fondo', programa: 'programa', estado: 'estado', nota: 'nota',
  hasta: 'hasta', hacerHasta: 'hacer_hasta', empresaId: 'empresa_id',
};

const actualizar = async (req, res, next) => {
  try {
    const sets = [];
    const params = [req.params.id];
    const cambios = {};
    for (const [campo, columna] of Object.entries(CAMPOS)) {
      if (!(campo in req.body)) continue;
      let valor = req.body[campo];
      if (typeof valor === 'string') valor = valor.trim();
      if (valor === '' && campo !== 'nombre') valor = null;
      params.push(valor);
      sets.push(`${columna} = $${params.length}`);
      cambios[campo] = campo === 'nota' ? (valor ? 'texto' : null) : valor;
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No hay nada que actualizar' });
    params.push(req.user.userId);
    // Se lee la fila ANTES de cambiarla (en la misma sentencia) para dejar en el registro el valor de antes: es lo que permite
    // ver en Actividad si alguien avanzó (de «Sin hacer» a «Al día», o la fecha de 2 jul a 15 sep).
    const { rows } = await db.query(
      `WITH prev AS (
         SELECT id, nombre, estado, to_char(hasta, 'YYYY-MM-DD') AS hasta FROM acuses_empresas WHERE id = $1 AND activa FOR UPDATE
       )
       UPDATE acuses_empresas a SET ${sets.join(', ')}, updated_by = $${params.length}, updated_at = NOW()
       FROM prev WHERE a.id = prev.id
       RETURNING a.id, a.area, prev.nombre AS nombre_antes, prev.estado AS estado_antes, prev.hasta AS hasta_antes`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Empresa no encontrada' });
    const { rows: [f] } = await db.query(`${SELECT} WHERE a.id = $1`, [req.params.id]);
    const antes = {};
    if ('estado' in cambios) antes.estado = rows[0].estado_antes;
    if ('hasta' in cambios) antes.hasta = rows[0].hasta_antes;
    await auditLog(req.user.userId, 'UPDATE', 'acuses', req.params.id, {
      area: rows[0].area, nombre: cambios.nombre ?? rows[0].nombre_antes, ...cambios, ...(Object.keys(antes).length ? { antes } : {}),
    });
    res.json({ ok: true, empresa: fila(f) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya hay una empresa con ese nombre en esta área' });
    if (err.code === '23503') return res.status(400).json({ error: 'La empresa del Directorio no existe' });
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const { area, nombre, empresaId = null, fondo = false, programa = null } = req.body;
    const { rows } = await db.query(
      `INSERT INTO acuses_empresas (area, nombre, empresa_id, fondo, programa, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [area, String(nombre).trim(), empresaId, fondo, programa ? String(programa).trim() : null, req.user.userId]
    );
    const { rows: [f] } = await db.query(`${SELECT} WHERE a.id = $1`, [rows[0].id]);
    await auditLog(req.user.userId, 'CREATE', 'acuses', rows[0].id, { area, nombre: f.nombre });
    res.status(201).json({ ok: true, empresa: fila(f) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya hay una empresa con ese nombre en esta área' });
    if (err.code === '23503') return res.status(400).json({ error: 'La empresa del Directorio no existe' });
    next(err);
  }
};

// No se borra: se desactiva, para no perder el historial ni la nota.
const quitar = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'UPDATE acuses_empresas SET activa = FALSE, updated_by = $2, updated_at = NOW() WHERE id = $1 AND activa RETURNING area, nombre',
      [req.params.id, req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Empresa no encontrada' });
    await auditLog(req.user.userId, 'DELETE', 'acuses', req.params.id, { area: rows[0].area, nombre: rows[0].nombre });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, actualizar, crear, quitar, AREAS, ESTADOS };
