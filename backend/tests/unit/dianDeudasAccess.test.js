jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const db = require('../../src/config/database');
const { requireDianGestion } = require('../../src/middleware/dianDeudasAccess');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const req = (role, userId = 'u1') => ({ user: { userId, role }, path: '/revisar-todas', method: 'POST' });

beforeEach(() => {
  db.query.mockReset();
});

describe('requireDianGestion', () => {
  test('sin sesión responde 401', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requireDianGestion({}, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('administrador y líder siempre pueden, sin consultar la base de datos', async () => {
    for (const role of ['admin', 'leader']) {
      const next = jest.fn();
      await requireDianGestion(req(role), mockRes(), next);
      expect(next).toHaveBeenCalledWith();
    }
    expect(db.query).not.toHaveBeenCalled();
  });

  test('un viewer no puede aunque tuviera el permiso guardado', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requireDianGestion(req('viewer'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  test('un miembro con el permiso activado puede (también con el nombre anterior canRevisarTodas)', async () => {
    for (const dianDeudas of [{ canGestionar: true }, { canRevisarTodas: true }]) {
      db.query.mockResolvedValueOnce({ rows: [{ permissions: { modulos: { dianDeudas } } }] });
      const next = jest.fn();
      await requireDianGestion(req('member'), mockRes(), next);
      expect(next).toHaveBeenCalledWith();
    }
  });

  test('sin el permiso (o con un valor que no es el booleano true) responde 403', async () => {
    for (const perms of [null, {}, { modulos: { dianDeudas: { canGestionar: false } } },
      { modulos: { dianDeudas: { canGestionar: 'true' } } }]) {
      db.query.mockResolvedValueOnce({ rows: [{ permissions: perms }] });
      const res = mockRes();
      const next = jest.fn();
      await requireDianGestion(req('member'), res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  });
});
