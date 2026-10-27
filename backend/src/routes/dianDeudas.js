// Deudas vencidas DIAN (ver controllers/dianDeudasController.js y migración 065).
// Lectura abierta a cualquier autenticado; revisar y anotar, a quien pueda editar (no viewer);
// manejar claves DIAN y lanzar "Revisar todas" (que carga el servidor), solo admin y líder.
const { Router } = require('express');
const { body } = require('express-validator');
const { authMiddleware, roleMiddleware, canEdit } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { validateUUIDParam } = require('../middleware/security');
const { requireDianGestion } = require('../middleware/dianDeudasAccess');
const c = require('../controllers/dianDeudasController');

const router = Router();
router.use(authMiddleware);

router.get('/', c.listar);
router.get('/progreso', c.progreso);
router.get('/revisiones/:id/correo', ...validateUUIDParam('id'), c.correo);

router.post('/empresas/:id/revisar', canEdit, ...validateUUIDParam('id'), c.revisar);
router.put('/revisiones/:id/correo-enviado', canEdit, ...validateUUIDParam('id'),
  body('enviado').optional().isBoolean().withMessage('enviado debe ser boolean'),
  validate,
  c.marcarCorreo
);
router.put('/revisiones/revisada-masiva', requireDianGestion,
  body('ids').isArray({ min: 1, max: 500 }).withMessage('ids debe ser una lista de 1 a 500'),
  body('ids.*').isUUID().withMessage('Cada id debe ser un UUID'),
  validate,
  c.marcarRevisadasMasivo
);
// El chulito "Revisada" también es de quien gestiona Deudas DIAN (admin, líder o con el permiso).
router.put('/revisiones/:id/revisada', requireDianGestion, ...validateUUIDParam('id'),
  body('revisada').optional().isBoolean().withMessage('revisada debe ser boolean'),
  validate,
  c.marcarRevisada
);
router.patch('/detalle/:id', canEdit, ...validateUUIDParam('id'),
  body('estado').isIn(['vigente', 'pagada', 'revisar']).withMessage("estado debe ser 'vigente', 'pagada' o 'revisar'"),
  body('nota').optional({ nullable: true }).isString().isLength({ max: 500 }),
  validate,
  c.resolverDetalle
);

// Claves para mostrar/copiar (presentación manual). Las ve cualquier usuario con sesión salvo "viewer". POST (no GET)
// para que las claves nunca queden en una URL ni en cachés/historiales del navegador.
const noViewer = (req, res, next) => (req.user.role === 'viewer'
  ? res.status(403).json({ error: 'Los usuarios de solo lectura no pueden ver las claves DIAN' })
  : next());
router.post('/claves', noViewer, c.claves);

// "Revisar todas", comentarios y chulito Revisada: admin, líder, o quien tenga `modulos.dianDeudas.canGestionar` (ver dianDeudasAccess.js).
router.put('/empresas/:id/comentario', requireDianGestion, ...validateUUIDParam('id'),
  body('texto').isString().withMessage('texto debe ser texto').isLength({ max: 1000 }).withMessage('El comentario admite hasta 1000 caracteres'),
  validate,
  c.guardarComentario
);
router.post('/revisar-todas', requireDianGestion,
  body('soloPendientes').optional().isBoolean().withMessage('soloPendientes debe ser boolean'),
  validate,
  c.revisarTodas
);

router.use(roleMiddleware('admin', 'leader'));

router.put('/empresas/:id/clave', ...validateUUIDParam('id'),
  body('clave').isString().notEmpty().withMessage('La clave es obligatoria').isLength({ max: 200 }),
  validate,
  c.guardarClave
);
router.delete('/empresas/:id/clave', ...validateUUIDParam('id'), c.quitarClave);
router.put('/empresas/:id/dian-config', ...validateUUIDParam('id'),
  body('ivaPeriodicidad').optional({ nullable: true }).isIn(['bimestral', 'cuatrimestral']).withMessage("ivaPeriodicidad debe ser 'bimestral' o 'cuatrimestral'"),
  validate,
  c.actualizarConfig
);

module.exports = router;
