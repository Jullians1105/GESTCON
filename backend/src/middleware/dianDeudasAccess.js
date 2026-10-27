// Permiso por usuario para gestionar Deudas DIAN: "Revisar todas" (lote de entradas reales a MUISCA), el chulito Revisada y los
// comentarios por empresa. Mismo patrón que empresasAccess.js: administrador y líder siempre pueden, y a los
// demás roles (excepto viewer) se les puede dar desde la pantalla Usuarios con
// `permissions.modulos.dianDeudas.canGestionar`. `canRevisarTodas` es el nombre anterior del permiso y se sigue
// aceptando para no quitarle el acceso a quien ya lo tenía.
const db = require('../config/database');
const logger = require('../utils/logger');

const requireDianGestion = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  const { userId, role } = req.user;

  if (role === 'admin' || role === 'leader') return next();

  if (role === 'viewer') {
    logger.warn({ userId, path: req.path, method: req.method }, 'requireDianGestion — viewer bloqueado');
    return res.status(403).json({ error: 'No tienes permiso para gestionar Deudas DIAN' });
  }

  try {
    const result = await db.query('SELECT permissions FROM users WHERE id = $1', [userId]);
    const dian = result.rows[0]?.permissions?.modulos?.dianDeudas;
    if (dian?.canGestionar === true || dian?.canRevisarTodas === true) return next();

    logger.warn(
      { userId, path: req.path, method: req.method },
      'requireDianGestion — permiso dianDeudas.canGestionar ausente'
    );
    return res.status(403).json({ error: 'No tienes permiso para gestionar Deudas DIAN' });
  } catch (err) {
    next(err);
  }
};

module.exports = { requireDianGestion };
