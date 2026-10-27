// Acuses (ver controllers/acusesController.js y migración 077): lectura para cualquier autenticado;
// editar, a quien pueda editar (no viewer).
const { Router } = require('express');
const { body } = require('express-validator');
const { authMiddleware, canEdit } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { validateUUIDParam } = require('../middleware/security');
const c = require('../controllers/acusesController');

const router = Router();
router.use(authMiddleware);

const fecha = (campo) => body(campo).optional({ nullable: true, checkFalsy: true }).isISO8601({ strict: true }).withMessage(`${campo} debe ser una fecha AAAA-MM-DD`);

router.get('/', c.listar);

router.post('/', canEdit,
  body('area').isIn(c.AREAS).withMessage('area inválida'),
  body('nombre').isString().trim().notEmpty().withMessage('El nombre es obligatorio').isLength({ max: 200 }),
  body('empresaId').optional({ nullable: true }).isUUID(),
  body('fondo').optional().isBoolean(),
  body('programa').optional({ nullable: true }).isString().isLength({ max: 60 }),
  validate,
  c.crear
);

router.patch('/:id', canEdit, ...validateUUIDParam('id'),
  body('nombre').optional().isString().trim().notEmpty().isLength({ max: 200 }),
  body('estado').optional().isIn(c.ESTADOS).withMessage('estado inválido'),
  body('fondo').optional().isBoolean(),
  body('programa').optional({ nullable: true }).isString().isLength({ max: 60 }),
  body('nota').optional({ nullable: true }).isString().isLength({ max: 1000 }),
  body('empresaId').optional({ nullable: true }).isUUID(),
  fecha('hasta'), fecha('hacerHasta'),
  validate,
  c.actualizar
);

router.delete('/:id', canEdit, ...validateUUIDParam('id'), c.quitar);

module.exports = router;
