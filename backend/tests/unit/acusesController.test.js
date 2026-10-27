// Endpoints de Acuses (controllers/acusesController.js).
jest.mock('../../src/config/database');
jest.mock('../../src/utils/auditLog', () => jest.fn().mockResolvedValue());

const db = require('../../src/config/database');
const auditLog = require('../../src/utils/auditLog');
const c = require('../../src/controllers/acusesController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const next = jest.fn();
const req = (o = {}) => ({ params: {}, query: {}, body: {}, user: { userId: 'u1', role: 'member' }, ...o });

const fila = (o = {}) => ({
  id: 'a1', area: 'contable', nombre: 'ACME', empresa_id: null, empresa_nombre: null, fondo: false, programa: null,
  estado: 'pendiente', hasta: null, hacer_hasta: null, nota: null, updated_at: '2026-10-26T10:00:00Z', actualizado_por: 'Ana', ...o,
});

beforeEach(() => {
  jest.resetAllMocks();
  auditLog.mockResolvedValue();
});

describe('listar', () => {
  it('devuelve las empresas con su fecha «hasta», la meta «hacer hasta» y quién actualizó', async () => {
    db.query.mockResolvedValue({ rows: [fila({ hasta: '2026-09-30', hacer_hasta: '2026-09-30', estado: 'al_dia', fondo: true })] });
    const res = mockRes();
    await c.listar(req(), res, next);
    expect(res.json).toHaveBeenCalledWith({
      empresas: [expect.objectContaining({ nombre: 'ACME', estado: 'al_dia', fondo: true, hasta: '2026-09-30', hacerHasta: '2026-09-30', actualizadoPor: 'Ana' })],
    });
  });
});

describe('actualizar', () => {
  it('solo cambia lo que viene, anota quién y cuándo, y deja registro sin el texto de la nota', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'a1', area: 'tributario', nombre_antes: 'ACME', estado_antes: 'pendiente', hasta_antes: '2026-07-02' }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [fila({ estado: 'al_dia' })] });      // SELECT
    const res = mockRes();
    await c.actualizar(req({ params: { id: 'a1' }, body: { estado: 'al_dia', nota: 'no deja guardar', hasta: '2026-10-01' } }), res, next);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/estado = \$2, nota = \$3, hasta = \$4/);
    expect(sql).toMatch(/WITH prev AS/);                 // lee la fila de ANTES para dejarla en el registro
    expect(sql).not.toMatch(/programa/);
    expect(params).toEqual(['a1', 'al_dia', 'no deja guardar', '2026-10-01', 'u1']);
    expect(auditLog).toHaveBeenCalledWith('u1', 'UPDATE', 'acuses', 'a1', {
      area: 'tributario', nombre: 'ACME', estado: 'al_dia', nota: 'texto', hasta: '2026-10-01', antes: { estado: 'pendiente', hasta: '2026-07-02' },
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, empresa: expect.objectContaining({ estado: 'al_dia' }) });
  });
  it('una fecha o nota vacía se guarda como NULL (se puede borrar)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'a1', area: 'contable' }] }).mockResolvedValueOnce({ rows: [fila()] });
    await c.actualizar(req({ params: { id: 'a1' }, body: { hasta: '', nota: '' } }), mockRes(), next);
    expect(db.query.mock.calls[0][1]).toEqual(['a1', null, null, 'u1']);
  });
  it('sin ningún campo: 400', async () => {
    const res = mockRes();
    await c.actualizar(req({ params: { id: 'a1' }, body: {} }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.query).not.toHaveBeenCalled();
  });
  it('404 si no existe o ya está quitada', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const res = mockRes();
    await c.actualizar(req({ params: { id: 'zz' }, body: { estado: 'al_dia' } }), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });
  it('409 si el nombre ya existe en esa área', async () => {
    db.query.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    const res = mockRes();
    await c.actualizar(req({ params: { id: 'a1' }, body: { nombre: 'OTRA' } }), res, next);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('crear', () => {
  it('crea en el área indicada y responde la fila', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'a9' }] }).mockResolvedValueOnce({ rows: [fila({ id: 'a9', area: 'externas', nombre: 'NUEVA' })] });
    const res = mockRes();
    await c.crear(req({ body: { area: 'externas', nombre: '  NUEVA ', fondo: false, programa: 'SIIGO' } }), res, next);
    expect(db.query.mock.calls[0][1]).toEqual(['externas', 'NUEVA', null, false, 'SIIGO', 'u1']);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(auditLog).toHaveBeenCalledWith('u1', 'CREATE', 'acuses', 'a9', { area: 'externas', nombre: 'NUEVA' });
  });
});

describe('quitar', () => {
  it('desactiva en vez de borrar', async () => {
    db.query.mockResolvedValue({ rows: [{ area: 'contable', nombre: 'ACME' }] });
    const res = mockRes();
    await c.quitar(req({ params: { id: 'a1' } }), res, next);
    expect(auditLog).toHaveBeenCalledWith('u1', 'DELETE', 'acuses', 'a1', { area: 'contable', nombre: 'ACME' });
    expect(db.query.mock.calls[0][0]).toMatch(/SET activa = FALSE/);
    expect(db.query.mock.calls[0][0]).not.toMatch(/DELETE/);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
