const { requireNEPlazoAdmin } = require('../../src/middleware/nominaElectronicaAccess');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireNEPlazoAdmin', () => {
  test('deja pasar a las cuentas responsables (usuarios demo 1 y 2), aunque no sean admin de rol', () => {
    const req = { user: { userId: '00000000-0000-0000-0000-0000000000a1', role: 'leader' } };
    const res = mockRes();
    const next = jest.fn();
    requireNEPlazoAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('deja pasar también a la segunda cuenta responsable (usuario demo 2)', () => {
    const req = { user: { userId: '00000000-0000-0000-0000-0000000000a2', role: 'member' } };
    const res = mockRes();
    const next = jest.fn();
    requireNEPlazoAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rechaza a cualquier otro usuario, incluido un admin de rol', () => {
    const req = { user: { userId: 'otro-usuario', role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();
    requireNEPlazoAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('401 sin usuario autenticado', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();
    requireNEPlazoAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
