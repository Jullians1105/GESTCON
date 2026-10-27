jest.mock('../../src/config/database');

const db = require('../../src/config/database');
const { describirEvento, clasificarEvento } = require('../../src/utils/actividadDescripcion');
const { requireActividad } = require('../../src/middleware/actividadAccess');
const { getActividad } = require('../../src/controllers/actividadController');

const EMP = '7bd9f4c5-de9c-4f5e-82e1-c5d61bbc4b6e';
const PROC = '5cbefc65-f9f0-4569-baf4-51c83d9fb362';

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('describirEvento', () => {
  test('checklist de Externas: empresa, proceso, estado y mes con nombres', () => {
    const r = describirEvento(
      { action: 'UPDATE', table_name: 'ext_checklist_items', record_id: 'x', changes: { empresaId: EMP, procesoId: PROC, estado: 'done', mes: 9, anio: 2026, nota: null } },
      { extEmp: { [EMP]: 'ACME SAS' }, extProc: { [PROC]: 'Declaración de IVA' } }
    );
    expect(r.area).toBe('Empresas Externas');
    expect(r.texto).toBe('Marcó «Declaración de IVA» de ACME SAS como Realizado (septiembre 2026)');
  });

  test('incluye la nota cuando existe y cae a "una empresa" si el nombre ya no existe', () => {
    const r = describirEvento(
      { action: 'UPDATE', table_name: 'fondo_checklist_items', changes: { empresaId: EMP, procesoId: PROC, estado: 'na', mes: 9, anio: 2026, nota: 'SALDO A FAVOR' } },
      {}
    );
    expect(r.texto).toBe('Marcó «un proceso» de una empresa como No aplica (septiembre 2026) — nota: SALDO A FAVOR');
  });

  test('claves DIAN: nunca muestra contenido, solo la acción y la cantidad', () => {
    const r = describirEvento({ action: 'READ', table_name: 'dian_clave', changes: { cantidad: 12, clave: 'secreta' } });
    expect(r.texto).toBe('Abrió una pantalla con claves DIAN');
    expect(r.texto).not.toContain('secreta');
  });

  test('Deudas DIAN: cada acción sobre una revisión tiene su propia frase', () => {
    const d = (action, changes, table_name = 'dian_deudas_revision') => describirEvento({ action, table_name, changes }).texto;
    expect(d('CREATE', { estado: 'al_dia' })).toBe('Revisó las deudas DIAN de una empresa');
    expect(d('UPDATE', { correoEnviado: true })).toBe('Marcó «Ya se envió» el correo de deudas DIAN de una empresa');
    expect(d('UPDATE', { correoEnviado: false })).toBe('Quitó la marca «Ya se envió» del correo de deudas DIAN de una empresa');
    expect(d('UPDATE', { marcadaRevisada: true })).toBe('Marcó como revisada a una empresa en Deudas DIAN');
    expect(d('UPDATE', { marcadaRevisada: false })).toBe('Quitó la marca de revisada a una empresa en Deudas DIAN');
    expect(d('UPDATE', { marcadas: 22 })).toBe('Marcó como revisadas a 22 empresas al día en Deudas DIAN');
    expect(d('UPDATE', { marcadas: 1 })).toBe('Marcó como revisadas a 1 empresa al día en Deudas DIAN');
    expect(d('UPDATE', { eliminado: false }, 'dian_deudas_comentario')).toBe('Escribió o editó el comentario de una empresa en Deudas DIAN');
    expect(d('UPDATE', { eliminado: true }, 'dian_deudas_comentario')).toBe('Eliminó el comentario de una empresa en Deudas DIAN');
    // Nunca la frase del correo para algo que no es el correo
    expect(d('UPDATE', { marcadaRevisada: true })).not.toMatch(/correo/);
  });

  test('Acuses con empresa: la frase dice cuál empresa y el antes → después', () => {
    const d = (action, changes, nombres = {}) => describirEvento({ action, table_name: 'acuses', record_id: 'r1', changes }, nombres).texto;
    expect(d('UPDATE', { area: 'contable', nombre: 'EMPRESA DEMO UNO', estado: 'al_dia', antes: { estado: 'pendiente' } }))
      .toBe('EMPRESA DEMO UNO (Contable): estado «Sin hacer» → «Al día»');
    expect(d('UPDATE', { area: 'tributario', nombre: 'AGENCIA LUMINA', hasta: '2026-09-15', antes: { hasta: '2026-07-02' } }))
      .toBe('AGENCIA LUMINA (Tributario): hasta 2 jul 2026 → 15 sep 2026 (+75 días)');
    expect(d('UPDATE', { area: 'tributario', nombre: 'AGENCIA LUMINA', hasta: '2026-07-01', antes: { hasta: '2026-07-02' } }))
      .toBe('AGENCIA LUMINA (Tributario): hasta 2 jul 2026 → 1 jul 2026 (-1 día)');
    expect(d('UPDATE', { area: 'externas', nombre: 'LA HUERTA', hasta: null, antes: { hasta: '2026-07-02' } })).toBe('LA HUERTA (Externas): quitó la fecha');
    expect(d('UPDATE', { area: 'externas', nombre: 'LA HUERTA', estado: 'no_se_puede', nota: 'texto', antes: { estado: 'pendiente' } }))
      .toBe('LA HUERTA (Externas): estado «Sin hacer» → «No se puede» · escribió o cambió la nota');
    expect(d('UPDATE', { area: 'externas', nombre: 'LA HUERTA', nota: null })).toBe('LA HUERTA (Externas): borró la nota');
    expect(d('CREATE', { area: 'externas', nombre: 'NUEVA' })).toBe('Agregó NUEVA (Externas) a los acuses');
    expect(d('DELETE', { area: 'externas', nombre: 'NUEVA' })).toBe('Quitó NUEVA (Externas) de los acuses');
    // registros anteriores (sin nombre en el registro): se busca por el id de la fila
    expect(d('UPDATE', { area: 'contable', estado: 'al_dia' }, { acuses: { r1: 'EMPRESA DEMO UNO' } })).toBe('EMPRESA DEMO UNO (Contable): estado «Al día»');
  });

  test('Acuses: se clasifica por lista y estado, y mide los días que avanzó la fecha', () => {
    const k = (changes) => clasificarEvento({ action: 'UPDATE', table_name: 'acuses', record_id: 'r1', changes });
    expect(k({ area: 'contable', nombre: 'X', estado: 'al_dia' })).toMatchObject({ item: 'Acuses · Contable', estadoClave: 'hecho', empresa: 'X', clave: 'r1|acuses' });
    expect(k({ area: 'tributario', nombre: 'X', estado: 'con_pendientes' }).estadoClave).toBe('proceso');
    expect(k({ area: 'externas', nombre: 'X', estado: 'no_se_puede' }).estadoClave).toBe('noaplica');
    expect(k({ area: 'externas', nombre: 'X', estado: 'pendiente' }).estadoClave).toBe('pendiente');
    expect(k({ area: 'contable', nombre: 'X', hasta: '2026-09-15', antes: { hasta: '2026-07-02' } })).toMatchObject({ estadoClave: null, avanceDias: 75 });
    expect(k({ area: 'contable', nombre: 'X', hasta: '2026-09-15' }).avanceDias).toBeUndefined();   // sin fecha de antes no se puede medir
  });

  test('Acuses: cada cambio tiene su frase con el área', () => {
    const d = (action, changes) => describirEvento({ action, table_name: 'acuses', changes }).texto;
    expect(d('CREATE', { area: 'contable' })).toBe('Agregó una empresa a los acuses de Contable');
    expect(d('UPDATE', { area: 'tributario', estado: 'al_dia' })).toBe('Cambió el estado de los acuses de una empresa de Tributario');
    expect(d('UPDATE', { area: 'externas', hasta: '2026-10-01' })).toBe('Actualizó hasta qué día quedaron los acuses de una empresa de Externas');
    expect(d('UPDATE', { area: 'contable', nota: 'texto' })).toBe('Escribió o cambió la nota de los acuses de una empresa de Contable');
    expect(d('UPDATE', { area: 'contable', empresaId: 'x' })).toBe('Enlazó con el Directorio una empresa de los acuses de Contable');
    expect(d('DELETE', { area: 'externas' })).toBe('Quitó una empresa de los acuses de Externas');
  });

  test('token DIAN fallido se distingue del exitoso', () => {
    expect(describirEvento({ action: 'CREATE', table_name: 'dian_token', changes: { success: false } }).texto).toMatch(/falló/);
    expect(describirEvento({ action: 'CREATE', table_name: 'dian_token', changes: { success: true } }).texto).toBe('Generó un token DIAN');
  });

  test('nómina electrónica: estados legibles', () => {
    const base = { action: 'UPDATE', table_name: 'ne_meses' };
    expect(describirEvento({ ...base, changes: { empresaId: EMP, estado: 'presentada', mes: 9, anio: 2026 } }, { neEmp: { [EMP]: 'ACME' } }).texto).toContain('como Presentada');
    expect(describirEvento({ ...base, changes: { empresaId: EMP, estado: 'no_aplica', mes: 9, anio: 2026 } }).texto).toContain('Dejó en espera la nómina electrónica');
    expect(describirEvento({ ...base, changes: { empresaId: EMP, estado: 'pendiente', autorizada: true, mes: 9, anio: 2026 } }).texto).toContain('Autorizó la nómina electrónica');
  });

  test('"vigente desde" de una empresa se describe con mes y año', () => {
    const r = describirEvento(
      { action: 'UPDATE', table_name: 'ne_empresas', record_id: EMP, changes: { vigenteDesdeAnio: 2026, vigenteDesdeMes: 9 } },
      { neEmp: { [EMP]: 'ACME' } }
    );
    expect(r.texto).toBe('Empezó ACME en Nómina Electrónica desde septiembre 2026');
  });

  test('tabla desconocida usa una descripción genérica en vez de fallar', () => {
    expect(describirEvento({ action: 'UPDATE', table_name: 'otra_tabla', changes: {} }).texto).toBe('Actualizó en otra_tabla');
  });
});

describe('requireActividad', () => {
  const next = jest.fn();
  test('admin pasa sin consultar permisos', async () => {
    await requireActividad({ user: { userId: 'u', role: 'admin' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(db.query).not.toHaveBeenCalled();
  });

  test('viewer siempre se bloquea', async () => {
    const res = mockRes();
    await requireActividad({ user: { userId: 'u', role: 'viewer' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('líder sin el permiso se bloquea; con permiso pasa', async () => {
    const sin = mockRes();
    db.query.mockResolvedValueOnce({ rows: [{ permissions: {} }] });
    await requireActividad({ user: { userId: 'u', role: 'leader' } }, sin, next);
    expect(sin.status).toHaveBeenCalledWith(403);

    next.mockClear();
    db.query.mockResolvedValueOnce({ rows: [{ permissions: { modulos: { actividad: { canVer: true } } } }] });
    await requireActividad({ user: { userId: 'u', role: 'leader' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('getActividad', () => {
  test('fecha inválida devuelve 400', async () => {
    const res = mockRes();
    await getActividad({ query: { fecha: '08/10/2026' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('agrupa por persona, cuenta por área y traduce nombres', async () => {
    const mk = (id, uid, uname, table, changes) => ({ id, user_id: uid, user_name: uname, action: 'UPDATE', table_name: table, record_id: 'r', changes, created_at: '2026-10-08T15:41:00Z' });
    db.query
      .mockResolvedValueOnce({
        rows: [
          mk('1', 'u1', 'Pablo', 'ext_checklist_items', { empresaId: EMP, procesoId: PROC, estado: 'done', mes: 9, anio: 2026 }),
          mk('2', 'u1', 'Pablo', 'ext_checklist_items', { empresaId: EMP, procesoId: PROC, estado: 'na', mes: 9, anio: 2026 }),
          mk('3', 'u2', 'Elena', 'tasks', { title: 'Llamar al cliente' }),
        ],
      })
      .mockResolvedValue({ rows: [] }); // consultas de nombres
    const res = mockRes();
    await getActividad({ query: { fecha: '2026-10-08' } }, res, jest.fn());

    const out = res.json.mock.calls[0][0];
    expect(out.total).toBe(3);
    expect(out.usuarios[0]).toMatchObject({ nombre: 'Pablo', nombreCorto: 'Pablo', total: 2, areas: { 'Empresas Externas': 2 } });
    expect(out.usuarios[1].eventos[0].texto).toContain('Llamar al cliente');
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain("AT TIME ZONE 'America/Bogota'");
    expect(db.query.mock.calls[0][1]).toEqual(['2026-10-08']);
  });
});
