import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useToast } from '../context/ToastContext'
import { Link } from 'react-router-dom'
import { Modal } from '../components/ClaveDianModal'
import CopiarDatosDian, { useClavesDian } from '../components/CopiarDatosDian'
import Cargando from '../components/Cargando'
import { normalizarBusqueda, contiene, documentoDeBusqueda } from '../utils/busqueda'

// Deudas vencidas DIAN: revisión mensual de cada empresa contra MUISCA (ver dianDeudasService.js).
// El botón "Revisar" entra a la DIAN con la clave guardada de la empresa, lee las deudas vencidas
// (con intereses), las cruza con los recibos ya pagados y deja el resultado del mes guardado aquí.

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const ESTADOS = {
  con_deuda: { label: 'Con deuda',      color: '#dc2626', bg: '#fef2f2', icon: 'warning' },
  al_dia:    { label: 'Al día',         color: '#16a34a', bg: '#f0fdf4', icon: 'check_circle' },
  pendiente: { label: 'Sin revisar',    color: '#6b7280', bg: '#f3f4f6', icon: 'pending' },
  clave:     { label: 'Clave inválida', color: '#b45309', bg: '#fffbeb', icon: 'key_off' },
  error:     { label: 'Error',          color: '#b45309', bg: '#fffbeb', icon: 'error' },
  sin_clave: { label: 'Sin clave',      color: '#9ca3af', bg: '#f3f4f6', icon: 'lock' },
}

const ESTADO_OBLIGACION = {
  vigente: { label: 'Se debe',  color: '#dc2626', bg: '#fef2f2' },
  pagada:  { label: 'Pagada',   color: '#16a34a', bg: '#f0fdf4' },
  revisar: { label: 'Revisar',  color: '#b45309', bg: '#fffbeb' },
}

const SEGUNDOS_POR_EMPRESA = 20 // referencia medida contra la DIAN (≈4 s sin deuda, ≈25 s con deuda)

const mesDeHoy = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const moverMes = (mes, delta) => {
  const [a, m] = mes.split('-').map(Number)
  const fecha = new Date(a, m - 1 + delta, 1)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}
const etiquetaMes = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`

// ¿Esa fecha es de HOY? Igual que el servidor: "Revisar todas" salta solo las revisadas hoy, no las de días atrás.
const esDeHoy = (iso) => !!iso && new Date(iso).toDateString() === new Date().toDateString()

const pesos = (v) => `$${Math.round(Number(v) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
// Los errores vienen crudos del navegador automatizado (ingles, con el registro técnico): acá se traducen a algo que
// la oficina entienda. El texto original sigue visible en el detalle de la empresa.
const motivoLegible = (msg) => {
  const m = String(msg ?? '').trim()
  if (!m) return 'No se pudo revisar (sin detalle).'
  if (/tard[óo] demasiado|timeout/i.test(m)) return 'La DIAN (MUISCA) tardó demasiado o no terminó de cargar una pantalla. Suele ser pasajero: se puede reintentar.'
  if (/waitForSelector|locator|Call log|page\.|net::/i.test(m)) return 'MUISCA no mostró una pantalla esperada. Suele ser pasajero: se puede reintentar; si se repite, avisar.'
  return m.split('\n')[0]
}

const esClaveInvalida = (e) => e.claveEstado === 'invalida' || e.estado === 'clave'
// Error propio o un reintento que falló sobre una revisión vieja (el dato mostrado puede estar desactualizado).
const esConError = (e) => !esClaveInvalida(e) && (e.estado === 'error' || !!e.ultimoFalloAt)

const fechaHora = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const Spinner = ({ size = 16 }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size, animation: 'spin 1s linear infinite' }}>progress_activity</span>
)

// ── Comentario de la empresa ─────────────────────────────────────────────────
// Un comentario por empresa y mes; al mes siguiente se muestra el del mes anterior ("heredado") hasta que alguien lo
// edite, lo elimine o escriba uno nuevo. Solo se edita en el mes en curso y con permiso de gestionar.
// Igual que las notas del Seguimiento mensual: un puntico amarillo indica que hay comentario y el texto sale en una
// notita al pasar el mouse; al hacer clic se abre el editor (o el texto, sin permiso) debajo del nombre.
function ComentarioBoton({ comentario, puedeEditar, abierto, onClick }) {
  const [nota, setNota] = useState(null) // { left, top } de la notita al pasar el mouse
  if (!comentario && !puedeEditar) return null
  const c = comentario

  const mostrar = (ev) => {
    if (!c || abierto) return
    const r = ev.currentTarget.getBoundingClientRect()
    setNota({ left: r.left, top: r.bottom + 6 })
  }

  return (
    <>
      <button
        type="button"
        onClick={(ev) => { ev.stopPropagation(); setNota(null); onClick() }}
        onMouseEnter={mostrar}
        onMouseLeave={() => setNota(null)}
        className={c
          ? 'mt-1.5 -ml-1 p-1 flex items-center rounded-full'
          : 'mt-1.5 flex items-center h-5 px-[5px] rounded-full bg-[#e5e7eb] text-[#6b7280] transition-[background-color,color,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-amber-300 hover:text-amber-900 hover:pr-2.5 active:scale-95'}
      >
        {c ? (
          <span className="block w-2.5 h-2.5 rounded-full bg-amber-400 ring-[3px] ring-amber-100" />
        ) : (
          <>
            <span className="block w-2 h-2 rounded-full bg-current flex-shrink-0" />
            <span className="text-[11px] font-semibold whitespace-nowrap overflow-hidden max-w-0 opacity-0 ml-0 transition-[max-width,opacity,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] [button:hover_&]:max-w-[150px] [button:hover_&]:opacity-100 [button:hover_&]:ml-1.5">
              Agregar comentario
            </span>
          </>
        )}
      </button>
      {nota && c && (
        <div
          className="fixed z-[60] shadow-lg text-xs text-[#1f1f1f] pointer-events-none"
          style={{ left: nota.left, top: nota.top, maxWidth: 280, background: '#fffef7', border: '1px solid #c8b800', borderRadius: 3 }}
        >
          <p className="whitespace-pre-wrap break-words leading-relaxed p-2">{c.texto}</p>
          <p className="px-2 pb-1.5 text-[10px] text-[#9ca3af]">
            {c.por ? `${c.por} · ` : ''}{c.at ? fechaHora(c.at) : ''}{c.heredado ? ` · de ${etiquetaMes(c.mes)}` : ''}
          </p>
        </div>
      )}
    </>
  )
}

function ComentarioPanel({ empresa, puedeEditar, onGuardar, onCerrar }) {
  const c = empresa.comentario
  const [texto, setTexto] = useState(c?.texto ?? '')
  const [guardando, setGuardando] = useState(false)

  const guardar = async (nuevo) => {
    setGuardando(true)
    const ok = await onGuardar(empresa, nuevo)
    setGuardando(false)
    if (ok) onCerrar()
  }

  return (
    <div className="mt-1.5" onClick={(ev) => ev.stopPropagation()}>
      {puedeEditar ? (
        <>
          <textarea
            value={texto}
            onChange={(ev) => setTexto(ev.target.value)}
            maxLength={1000}
            rows={2}
            autoFocus
            placeholder="Escribe un comentario…"
            className="w-full px-2.5 py-1.5 rounded-lg border border-[#d1d5db] text-xs text-[#191c1e] leading-relaxed resize-y focus:outline-none focus:border-[#003B43]"
          />
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => guardar(texto)}
              disabled={guardando}
              className="px-3 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition active:scale-[0.97]"
              style={{ background: '#003B43' }}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={onCerrar} disabled={guardando} className="px-3 py-1 rounded-lg text-xs font-semibold text-[#434655] hover:bg-[#f3f4f6] transition">Cancelar</button>
            {c && (
              <button onClick={() => guardar('')} disabled={guardando} className="ml-auto px-2 py-1 rounded-lg text-xs font-semibold text-[#dc2626] hover:bg-[#fef2f2] transition">Eliminar</button>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-[#434655] leading-relaxed whitespace-pre-wrap break-words">{c?.texto}</p>
      )}
      {c?.heredado && (
        <p className="text-[11px] text-[#9ca3af] mt-1">Es de {etiquetaMes(c.mes)}: edítalo, elimínalo o escribe uno nuevo.</p>
      )}
    </div>
  )
}

// ── Chulito de "Revisada" ────────────────────────────────────────────────────
// Al marcar: el cuadro se rellena y el chulito se "dibuja" (trazo animado) con un pequeño rebote.
function ChulitoRevisada({ marcada, disabled, onClick, title }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label="Revisada"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-[5px] border-2 transition-[background-color,border-color,transform] duration-200 ease-out active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        background: marcada ? '#003B43' : '#fff',
        borderColor: marcada ? '#003B43' : '#c3c6d7',
        transform: marcada ? 'scale(1.08)' : 'scale(1)',
      }}
    >
      <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path
          d="M2.5 7.5l3 3 6-6.5"
          style={{
            strokeDasharray: 14,
            strokeDashoffset: marcada ? 0 : 14,
            transition: 'stroke-dashoffset 260ms ease-out 60ms',
          }}
        />
      </svg>
    </button>
  )
}

// ── Correo al cliente ─────────────────────────────────────────────────────────
function CorreoModal({ empresa, onClose, onCambio }) {
  const { addToast } = useToast()
  const [correo, setCorreo] = useState(null)
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(!!empresa.correoEnviadoAt)

  useEffect(() => {
    api.getCorreoDeudaDian(empresa.revisionId)
      .then((c) => { setCorreo(c); setTexto(c.texto) })
      .catch((err) => setError(err.message || 'No se pudo armar el correo'))
  }, [empresa.revisionId])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      addToast('Texto copiado', 'success')
    } catch {
      addToast('No se pudo copiar; selecciona el texto a mano', 'error')
    }
  }

  const alternarEnviado = async () => {
    try {
      await api.marcarCorreoDeudaDian(empresa.revisionId, !enviado)
      setEnviado(!enviado)
      onCambio()
    } catch (err) {
      addToast(err.message || 'No se pudo actualizar', 'error')
    }
  }

  return (
    <Modal onClose={onClose} ancho="max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-[#003B43]" style={{ fontSize: 20 }}>mail</span>
        <h3 className="text-base font-bold text-[#191c1e]">Correo a {empresa.name}</h3>
      </div>
      <p className="text-xs text-[#6b7280] mb-3">
        Solo incluye lo que se debe (no lo pagado ni lo marcado para revisar). Puedes ajustar el texto antes de copiarlo;
        el envío se hace desde Gmail y aquí queda anotado.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!correo && !error && <div className="flex items-center gap-2 text-sm text-[#8890b5] py-6"><Spinner /> Armando el correo…</div>}
      {correo && (
        <>
          <p className="text-xs font-semibold text-[#434655] mb-1">Asunto</p>
          <p className="text-sm text-[#191c1e] mb-3 px-3 py-2 rounded-lg bg-[#f0f2f8]">{correo.asunto}</p>
          <p className="text-xs font-semibold text-[#434655] mb-1">Mensaje</p>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={14}
            className="w-full px-3 py-2 rounded-lg border border-[#d1d5db] text-sm text-[#191c1e] leading-relaxed"
          />
          <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#434655] cursor-pointer">
              <input type="checkbox" checked={enviado} onChange={alternarEnviado} />
              Ya se envió{enviado && empresa.correoEnviadoAt ? ` (${fechaHora(empresa.correoEnviadoAt)})` : ''}
            </label>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs font-semibold text-[#6b7280] hover:bg-[#f3f4f6]">Cerrar</button>
              <button onClick={copiar} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#003B43] transition active:scale-[0.97]">
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>content_copy</span>
                Copiar mensaje
              </button>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}

// ── Revisar todas: confirmación ───────────────────────────────────────────────
function LoteModal({ empresas, onClose, onConfirmar }) {
  const [soloPendientes, setSoloPendientes] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const aRevisar = useMemo(() => empresas.filter((e) => (
    e.tieneClave && e.claveEstado !== 'invalida' && (!soloPendientes || !(['al_dia', 'con_deuda'].includes(e.estado) && esDeHoy(e.revisadoAt)))
  )).length, [empresas, soloPendientes])
  const minutos = Math.max(1, Math.round((aRevisar * SEGUNDOS_POR_EMPRESA) / 2 / 60))

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-[#003B43]" style={{ fontSize: 20 }}>playlist_play</span>
        <h3 className="text-base font-bold text-[#191c1e]">Revisar todas</h3>
      </div>
      <p className="text-sm text-[#434655] mb-3">
        Se revisarán <b>{aRevisar}</b> empresa{aRevisar !== 1 ? 's' : ''} con clave guardada, de a 2 a la vez, en segundo plano
        (unos {minutos} min). Puedes seguir usando la página; el avance se ve arriba.
      </p>
      <label className="flex items-center gap-2 text-xs font-semibold text-[#434655] cursor-pointer mb-4">
        <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
        Saltar las que ya se revisaron hoy
      </label>
      <p className="text-[11px] text-[#6b7280] mb-4">
        Las empresas con clave rechazada se saltan siempre (hay que cargar una nueva). Un lote usa el mismo navegador que el generador de token.
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs font-semibold text-[#6b7280] hover:bg-[#f3f4f6]">Cancelar</button>
        <button
          disabled={aRevisar === 0 || enviando}
          onClick={async () => { setEnviando(true); await onConfirmar(soloPendientes); setEnviando(false) }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#003B43] disabled:opacity-40 transition active:scale-[0.97]"
        >
          {enviando ? <Spinner size={14} /> : <span className="material-symbols-outlined" style={{ fontSize: 15 }}>play_arrow</span>}
          Empezar
        </button>
      </div>
    </Modal>
  )
}

// Lo que se debe (obligaciones 'vigentes'), separado en vencido y por vencer: la DIAN muestra "DEUDA VENCIDA" y
// "DEUDA NO VENCIDA" por aparte; las no vencidas aún no causan intereses pero también se avisan al cliente.
const totalesDeuda = (detalle) => {
  const vigentes = detalle.filter((d) => d.estado === 'vigente')
  const suma = (lista) => lista.reduce((s, d) => s + Number(d.valorTotal), 0)
  return { vencido: suma(vigentes.filter((d) => d.vencida !== false)), porVencer: suma(vigentes.filter((d) => d.vencida === false)) }
}

// ── Detalle de una empresa (contenido de la fila expandida) ───────────────────
function DetalleEmpresa({ empresa, puedeEditar, esMesActual, onResolver, onCorreo }) {
  const hayIva = empresa.detalle.some((d) => d.concepto === 'iva')
  const haySeDebe = empresa.detalle.some((d) => d.estado === 'vigente')
  const { vencido, porVencer } = totalesDeuda(empresa.detalle)

  return (
    <div className="flex flex-col gap-3">
      {esClaveInvalida(empresa) && (
        <div className="text-xs bg-[#fffbeb] border border-[#fde68a] rounded-lg px-3 py-2 text-[#92400e]">
          <p className="font-semibold">La DIAN rechazó la clave de esta empresa</p>
          <p className="mt-0.5">No se reintenta sola para no bloquear la cuenta del cliente. Hay que cargar una clave nueva en el{' '}
            <Link to={`/empresas?buscar=${encodeURIComponent(empresa.name)}`} className="font-semibold underline">Directorio de empresas</Link>.</p>
        </div>
      )}
      {empresa.estado === 'error' && (
        <div className="text-xs bg-[#fffbeb] border border-[#fde68a] rounded-lg px-3 py-2 text-[#92400e]">
          <p className="font-semibold">No se pudo revisar{empresa.revisadoAt ? ` (${fechaHora(empresa.revisadoAt)})` : ''}</p>
          <p className="mt-0.5">{motivoLegible(empresa.mensaje)}</p>
          {empresa.mensaje && empresa.mensaje !== motivoLegible(empresa.mensaje) && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[#b45309]">Ver el detalle técnico</summary>
              <pre className="mt-1 whitespace-pre-wrap break-words text-[10px] text-[#6b7280]">{empresa.mensaje}</pre>
            </details>
          )}
        </div>
      )}
      {empresa.ultimoFalloAt && empresa.estado !== 'error' && (
        <div className="text-xs bg-[#fffbeb] border border-[#fde68a] rounded-lg px-3 py-2 text-[#92400e]">
          <p className="font-semibold">El último intento de revisar falló ({fechaHora(empresa.ultimoFalloAt)})</p>
          <p className="mt-0.5">Lo que ves abajo es de la revisión anterior ({empresa.revisadoAt ? fechaHora(empresa.revisadoAt) : '—'}) y puede estar desactualizado, con los intereses de ese día. {motivoLegible(empresa.ultimoFalloMensaje)}</p>
          {empresa.ultimoFalloMensaje && empresa.ultimoFalloMensaje !== motivoLegible(empresa.ultimoFalloMensaje) && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[#b45309]">Ver el detalle técnico</summary>
              <pre className="mt-1 whitespace-pre-wrap break-words text-[10px] text-[#6b7280]">{empresa.ultimoFalloMensaje}</pre>
            </details>
          )}
        </div>
      )}
      {empresa.mensaje && !['error', 'clave'].includes(empresa.estado) && (
        <p className="text-xs text-[#434655] bg-white border border-[#e2e4ef] rounded-lg px-3 py-2">{empresa.mensaje}</p>
      )}

      {empresa.detalle.length > 0 && (
        <div className="bg-white border border-[#e2e4ef] rounded-xl overflow-hidden">
          {empresa.detalle.map((d, i) => {
            const est = ESTADO_OBLIGACION[d.estado]
            return (
              <div key={d.id} className={`flex items-start gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-[#f0f2f8]' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#191c1e]">
                    {d.descripcion}
                    {d.vencida === false && (
                      <span className="ml-2 align-middle text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: '#eef3ff', color: '#434655' }} title="Aún está dentro del plazo de pago: todavía no causa intereses">No vencida</span>
                    )}
                  </p>
                  {d.nota && <p className="text-[11px] text-[#6b7280] mt-0.5">{d.nota}</p>}
                  {d.estado === 'revisar' && puedeEditar && esMesActual && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <button onClick={() => onResolver(d.id, 'pagada')} className="text-[11px] font-semibold text-[#16a34a] hover:underline">Es el mismo pago: marcar pagada</button>
                      <span className="text-[#c3c6d7]">·</span>
                      <button onClick={() => onResolver(d.id, 'vigente')} className="text-[11px] font-semibold text-[#dc2626] hover:underline">Sigue debiéndose</button>
                    </div>
                  )}
                </div>
                <span className="text-sm font-bold text-[#191c1e] whitespace-nowrap">{pesos(d.valorTotal)}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: est.bg, color: est.color }}>{est.label}</span>
              </div>
            )
          })}
          {haySeDebe && (
            <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#f0f2f8] text-xs">
              <span className="text-[#6b7280]">Las vencidas, con intereses a la fecha de la revisión</span>
              <span className="font-bold text-[#191c1e]">
                {vencido > 0 && `Vencido: ${pesos(vencido)}`}
                {vencido > 0 && porVencer > 0 && ' · '}
                {porVencer > 0 && `Por vencer: ${pesos(porVencer)}`}
              </span>
            </div>
          )}
        </div>
      )}

      {hayIva && !empresa.ivaPeriodicidad && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Falta definir si el IVA de esta empresa es bimestral o cuatrimestral: sin eso el correo dice &ldquo;periodo N&rdquo; en vez de los meses.{' '}
          <Link to={`/empresas?buscar=${encodeURIComponent(empresa.name)}`} className="font-semibold underline">Configurar en el Directorio</Link>
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {haySeDebe && empresa.revisionId && (
          <button onClick={onCorreo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#003B43] text-[#003B43] hover:bg-[#003B43]/10 transition">
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>mail</span>
            Ver correo
            {empresa.correoEnviadoAt && <span className="text-[10px] font-bold text-[#16a34a]">· enviado {fechaHora(empresa.correoEnviadoAt)}</span>}
          </button>
        )}
        {empresa.revisadoAt && (
          <span className="text-[11px] text-[#9ca3af] ml-auto">
            Revisada {fechaHora(empresa.revisadoAt)}{empresa.revisadoPor ? ` por ${empresa.revisadoPor}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function DeudasDianPage() {
  const { user } = useAuth()
  const { socket } = useSocket()
  const { addToast } = useToast()
  const puedeEditar = user?.role !== 'viewer'
  const puedeAdministrar = user?.role === 'admin' || user?.role === 'leader'
  // "Revisar todas" y comentarios: además de admin/líder, quien tenga el permiso en Usuarios (el servidor lo valida igual).
  // `canRevisarTodas` es el nombre anterior del permiso.
  const dianPerm = user?.permissions?.modulos?.dianDeudas
  const puedeGestionar = puedeAdministrar
    || (user?.role !== 'viewer' && (dianPerm?.canGestionar === true || dianPerm?.canRevisarTodas === true))

  const claves = useClavesDian()
  // Las claves se ven por defecto (decisión del usuario); este ojo las tapa con puntos si hay alguien mirando la pantalla.
  const [mostrarClaves, setMostrarClaves] = useState(() => {
    try { return localStorage.getItem('deudas_dian_mostrar_claves') !== '0' } catch { return true }
  })
  const alternarClaves = () => setMostrarClaves((v) => {
    try { localStorage.setItem('deudas_dian_mostrar_claves', v ? '0' : '1') } catch { /* sin almacenamiento: solo esta sesión */ }
    return !v
  })

  const hoy = mesDeHoy()
  const [mes, setMes] = useState(hoy)
  const esMesActual = mes === hoy
  const [datos, setDatos] = useState({ empresas: [], llaveConfigurada: true })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [abiertoId, setAbiertoId] = useState(null)
  const [revisando, setRevisando] = useState(() => new Set())
  const [progreso, setProgreso] = useState(null)
  const [correoDe, setCorreoDe] = useState(null) // id de empresa
  const [loteAbierto, setLoteAbierto] = useState(false)
  const [comentarioAbierto, setComentarioAbierto] = useState(null) // id de empresa
  // El aviso de "terminó el lote" se cierra por lote (se recuerda cuál en este navegador).
  const [avisoCerrado, setAvisoCerrado] = useState(() => {
    try { return localStorage.getItem('dianLoteAvisoCerrado') } catch { return null }
  })
  const cerrarAviso = () => {
    try { localStorage.setItem('dianLoteAvisoCerrado', progreso.terminadaAt) } catch { /* sin almacenamiento */ }
    setAvisoCerrado(progreso.terminadaAt)
  }

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) { setCargando(true); setError('') }
    try {
      setDatos(await api.getDeudasDian(mes))
    } catch (err) {
      if (!silencioso) setError(err.message || 'No se pudieron cargar las empresas')
    } finally {
      if (!silencioso) setCargando(false)
    }
  }, [mes])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { api.getDeudasDianProgreso().then(setProgreso).catch(() => {}) }, [])

  // Durante "Revisar todas" llegan muchos avisos seguidos: se recarga la lista a lo sumo cada 3 s.
  const temporizador = useRef(null)
  const recargarPronto = useCallback(() => {
    if (temporizador.current) return
    temporizador.current = setTimeout(() => { temporizador.current = null; cargar({ silencioso: true }) }, 3000)
  }, [cargar])
  useEffect(() => () => clearTimeout(temporizador.current), [])

  useEffect(() => {
    if (!socket) return undefined
    const alProgreso = (p) => { setProgreso(p); if (!p.enCurso) cargar({ silencioso: true }) }
    socket.on('dianDeudas:progreso', alProgreso)
    socket.on('dianDeudas:revisada', recargarPronto)
    return () => { socket.off('dianDeudas:progreso', alProgreso); socket.off('dianDeudas:revisada', recargarPronto) }
  }, [socket, cargar, recargarPronto])

  const empresas = datos.empresas
  const resumen = useMemo(() => {
    const r = { conClave: 0, revisadas: 0, conDeuda: 0, vencido: 0, porVencer: 0 }
    for (const e of empresas) {
      if (e.tieneClave) r.conClave += 1
      if (e.estado === 'al_dia' || e.estado === 'con_deuda') r.revisadas += 1
      if (e.estado === 'con_deuda') {
        r.conDeuda += 1
        const t = totalesDeuda(e.detalle)
        r.vencido += t.vencido
        r.porVencer += t.porVencer
      }
    }
    return r
  }, [empresas])

  const TABS = useMemo(() => {
    const def = [
      { key: 'todas',     label: 'Todas',        fn: () => true },
      { key: 'deuda',     label: 'Con deuda',    fn: (e) => e.estado === 'con_deuda' },
      { key: 'aldia',     label: 'Al día',       fn: (e) => e.estado === 'al_dia' },
      // Errores: clave inválida, error de la revisión o un reintento que falló (el motivo se ve en cada fila).
      { key: 'errores',   label: 'Errores',      fn: (e) => esClaveInvalida(e) || esConError(e) },
      { key: 'sinmarcar', label: 'Sin marcar',   fn: (e) => !!e.revisionId && !e.marcadaRevisadaAt },
      { key: 'sinclave',  label: 'Sin clave',    fn: (e) => e.estado === 'sin_clave' },
    ]
    return def.map((t) => ({ ...t, count: empresas.filter(t.fn).length }))
  }, [empresas])

  const filtradas = useMemo(() => {
    const tabActivo = TABS.find((t) => t.key === tab) ?? TABS[0]
    const q = normalizarBusqueda(busqueda)
    const doc = documentoDeBusqueda(busqueda)
    return empresas.filter((e) => tabActivo.fn(e) && (!q || contiene(e.name, q) || (doc && (e.nit ?? '').includes(doc))))
  }, [empresas, TABS, tab, busqueda])

  // Las «Al día» visibles que aún no tienen el chulito (respeta la búsqueda).
  const sinMarcarAlDia = useMemo(
    () => (tab === 'aldia' ? filtradas.filter((x) => x.estado === 'al_dia' && x.revisionId && !x.marcadaRevisadaAt) : []),
    [tab, filtradas]
  )

  const revisar = async (empresa) => {
    setRevisando((prev) => new Set(prev).add(empresa.id))
    try {
      const r = await api.revisarDeudasDian(empresa.id)
      const msg = {
        al_dia: [`${empresa.name}: al día`, 'success'],
        con_deuda: [`${empresa.name}: tiene deuda pendiente`, 'info'],
        clave: [`${empresa.name}: la DIAN rechazó la clave`, 'error'],
        error: [`${empresa.name}: no se pudo revisar (${r.mensaje ?? 'error'})`, 'error'],
      }[r.estado]
      if (msg) addToast(msg[0], msg[1], 5000)
      await cargar({ silencioso: true })
      if (r.estado === 'con_deuda') setAbiertoId(empresa.id)
    } catch (err) {
      addToast(err.message || 'No se pudo revisar', 'error', 6000)
      await cargar({ silencioso: true })
    } finally {
      setRevisando((prev) => { const s = new Set(prev); s.delete(empresa.id); return s })
    }
  }

  const revisarTodas = async (soloPendientes) => {
    try {
      const r = await api.revisarTodasDeudasDian(soloPendientes)
      setLoteAbierto(false)
      if (r.total === 0) addToast('No hay empresas por revisar', 'info')
      else addToast(`Revisando ${r.total} empresa${r.total !== 1 ? 's' : ''} en segundo plano`, 'info')
    } catch (err) {
      addToast(err.message || 'No se pudo iniciar la revisión', 'error', 6000)
    }
  }

  const guardarComentario = async (e, texto) => {
    try {
      const r = await api.guardarComentarioDeudaDian(e.id, texto)
      setDatos((d) => ({ ...d, empresas: d.empresas.map((x) => (x.id === e.id ? { ...x, comentario: r.comentario } : x)) }))
      return true
    } catch (err) {
      addToast(err.message || 'No se pudo guardar el comentario', 'error')
      return false
    }
  }

  // «Al día» → marcar todas las visibles como revisadas de una vez (se pide confirmación en el mismo botón).
  const [confirmandoMasivo, setConfirmandoMasivo] = useState(false)
  const [marcandoMasivo, setMarcandoMasivo] = useState(false)
  const marcarTodasRevisadas = async (lista) => {
    setMarcandoMasivo(true)
    try {
      const r = await api.marcarRevisadasMasivoDeudaDian(lista.map((x) => x.revisionId))
      const porRevision = new Map(r.marcadas.map((m) => [m.revisionId, m]))
      setDatos((d) => ({
        ...d,
        empresas: d.empresas.map((x) => {
          const m = porRevision.get(x.revisionId)
          return m ? { ...x, marcadaRevisadaAt: m.marcadaRevisadaAt, marcadaRevisadaPor: m.marcadaRevisadaPor } : x
        }),
      }))
      addToast(`${r.marcadas.length} empresa${r.marcadas.length !== 1 ? 's' : ''} marcada${r.marcadas.length !== 1 ? 's' : ''} como revisada${r.marcadas.length !== 1 ? 's' : ''}`, 'success')
    } catch (err) {
      addToast(err.message || 'No se pudo marcar', 'error')
      await cargar({ silencioso: true })
    } finally {
      setMarcandoMasivo(false)
      setConfirmandoMasivo(false)
    }
  }

  const marcarRevisada = async (e) => {
    const revisada = !e.marcadaRevisadaAt
    setDatos((d) => ({
      ...d,
      empresas: d.empresas.map((x) => (x.id === e.id ? { ...x, marcadaRevisadaAt: revisada ? new Date().toISOString() : null } : x)),
    }))
    try {
      const r = await api.marcarRevisadaDeudaDian(e.revisionId, revisada)
      // Solo se actualiza esta fila con lo que respondió el servidor; no se recarga la lista.
      setDatos((d) => ({
        ...d,
        empresas: d.empresas.map((x) => (x.id === e.id ? { ...x, marcadaRevisadaAt: r.marcadaRevisadaAt, marcadaRevisadaPor: r.marcadaRevisadaPor } : x)),
      }))
    } catch (err) {
      addToast(err.message || 'No se pudo actualizar', 'error')
      await cargar({ silencioso: true })
    }
  }
  const resolver = async (detalleId, estado) => {
    try {
      await api.resolverDetalleDeudaDian(detalleId, estado)
      await cargar({ silencioso: true })
    } catch (err) {
      addToast(err.message || 'No se pudo actualizar', 'error')
    }
  }

  const empresaCorreo = correoDe && empresas.find((e) => e.id === correoDe)
  const loteEnCurso = !!progreso?.enCurso
  const fallidasLote = progreso?.fallidas ?? []
  const faltaron = fallidasLote.filter((f) => f.estado === 'error')
  const clavesInvalidas = empresas.filter(esClaveInvalida).length
  const mostrarAviso = !!progreso && !progreso.enCurso && !!progreso.terminadaAt && progreso.total > 0
    && esMesActual && avisoCerrado !== progreso.terminadaAt
  const pctLote = progreso?.total ? progreso.hechas / progreso.total : 0

  if (cargando) return (
    <Cargando texto="Cargando deudas DIAN…" />
  )

  if (error) return (
    <div className="max-w-6xl mx-auto mt-20 flex flex-col items-center gap-3">
      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      <button onClick={() => cargar()} className="px-4 py-2 text-sm rounded-xl border border-[#e2e4ef] hover:bg-[#f3f4f6] transition">Reintentar</button>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto">
      {/* ── Encabezado ─────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-3xl text-[#E5A70C]">account_balance_wallet</span>
            <h1 className="text-2xl font-bold text-[#191c1e]">Deudas DIAN</h1>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs flex-wrap">
            <span className="text-[#6b7280]"><b className="text-[#191c1e] text-sm">{resumen.revisadas}</b> revisadas de {resumen.conClave} con clave</span>
            {resumen.conDeuda > 0 && (
              <span className="text-[#6b7280]">
                <b className="text-[#dc2626] text-sm">{resumen.conDeuda}</b> con deuda
                {resumen.vencido > 0 && <> · <b className="text-[#dc2626]">{pesos(resumen.vencido)}</b> vencido</>}
                {resumen.porVencer > 0 && <> · {pesos(resumen.porVencer)} por vencer</>}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 bg-white border border-[#e2e4ef] rounded-xl px-3 py-2 shadow-sm">
          <button onClick={() => setMes(moverMes(mes, -1))} className="p-0.5 rounded hover:bg-[#f3f4f6] transition text-[#6b7280]">
            <span className="material-symbols-outlined text-xl">chevron_left</span>
          </button>
          <span className="text-sm font-semibold text-[#191c1e] px-2 min-w-[140px] text-center">{etiquetaMes(mes)}</span>
          <button
            onClick={() => setMes(moverMes(mes, 1))}
            disabled={esMesActual}
            className="p-0.5 rounded hover:bg-[#f3f4f6] transition text-[#6b7280] disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-xl">chevron_right</span>
          </button>
        </div>
      </div>

      {!esMesActual && (
        <p className="mb-4 text-xs text-[#6b7280] bg-[#f0f2f8] border border-[#e2e4ef] rounded-lg px-3 py-2">
          Estás viendo el historial de {etiquetaMes(mes)}. Las revisiones nuevas siempre se guardan en el mes en curso.
        </p>
      )}

      {puedeAdministrar && !datos.llaveConfigurada && (
        <p className="mb-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          El servidor no tiene configurada la llave de cifrado (DIAN_CLAVES_KEY): no se pueden guardar claves DIAN hasta que se defina.
        </p>
      )}

      {/* ── Buscar + acciones ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative w-72 flex-shrink-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] text-lg">search</span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o NIT…"
            className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-[#d1d5db] bg-white text-sm text-[#191c1e] focus:outline-none focus:ring-2 focus:ring-[#003B43]/30"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} title="Borrar búsqueda" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#434655] transition">
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>close</span>
            </button>
          )}
        </div>
        {Object.keys(claves).length > 0 && (
          <button
            onClick={alternarClaves}
            title={mostrarClaves ? 'Tapar las claves en pantalla' : 'Mostrar las claves'}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#6b7280] border border-[#d1d5db] bg-white hover:bg-[#f3f4f6] transition"
          >
            <span className="material-symbols-outlined text-lg">{mostrarClaves ? 'visibility' : 'visibility_off'}</span>
            Claves
          </button>
        )}
        {puedeGestionar && esMesActual && (
          <button
            onClick={() => setLoteAbierto(true)}
            disabled={loteEnCurso}
            title="Revisa en segundo plano todas las empresas con clave guardada"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#003B43] bg-[#E3EEEE] hover:bg-[#d3e4e4] transition active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-lg">playlist_play</span>
            Revisar todas
          </button>
        )}
      </div>

      {/* ── Avance de "Revisar todas" ───────────────────────────────────── */}
      {loteEnCurso && (
        <div className="mb-4 bg-white border border-[#e2e4ef] rounded-xl px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-3 text-xs mb-2">
            <span className="flex items-center gap-2 font-semibold text-[#191c1e]">
              <Spinner size={14} /> Revisando {progreso.hechas} de {progreso.total}
            </span>
            <span className="text-[#6b7280]">
              {progreso.conDeuda} con deuda · {progreso.alDia} al día
              {progreso.clave > 0 && ` · ${progreso.clave} clave inválida`}
              {progreso.errores > 0 && ` · ${progreso.errores} con error`}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[#f0f2f8] overflow-hidden">
            <div className="h-full w-full bg-[#003B43] origin-left" style={{ transform: `scaleX(${pctLote})`, transition: 'transform 300ms ease-out' }} />
          </div>
          {progreso.empresasActuales?.length > 0 && (
            <p className="text-[11px] text-[#9ca3af] mt-1.5 truncate">Ahora: {progreso.empresasActuales.join(' · ')}</p>
          )}
        </div>
      )}

      {/* ── Aviso al terminar "Revisar todas" ───────────────────────────── */}
      {mostrarAviso && (
        <div
          className="mb-4 rounded-xl px-4 py-3 shadow-sm border"
          style={fallidasLote.length > 0 ? { background: '#fffbeb', borderColor: '#fde68a' } : { background: '#f0fdf4', borderColor: '#bbf7d0' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: fallidasLote.length > 0 ? '#92400e' : '#166534' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{fallidasLote.length > 0 ? 'warning' : 'check_circle'}</span>
                {fallidasLote.length > 0
                  ? `Terminó la revisión, pero ${fallidasLote.length === 1 ? 'faltó 1 empresa' : `faltaron ${fallidasLote.length} empresas`}`
                  : 'Terminó la revisión de todas las empresas'}
              </p>
              <p className="text-xs text-[#434655] mt-0.5">
                {progreso.hechas} revisadas: {progreso.conDeuda} con deuda · {progreso.alDia} al día
                {progreso.clave > 0 && ` · ${progreso.clave} con clave inválida`}
                {progreso.errores > 0 && ` · ${progreso.errores} con error`}
              </p>
            </div>
            <button onClick={cerrarAviso} className="p-0.5 rounded hover:bg-black/5 text-[#6b7280] flex-shrink-0" title="Cerrar este aviso">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>

          {fallidasLote.length > 0 && (
            <ul className="mt-2 max-h-48 overflow-y-auto divide-y divide-[#fde68a]/60 text-xs">
              {fallidasLote.map((f) => (
                <li key={f.id} className="py-1.5 flex flex-col sm:flex-row sm:gap-3">
                  <span className="font-semibold text-[#191c1e] sm:w-[34%] flex-shrink-0">{f.name}</span>
                  <span className="text-[#92400e]">
                    {f.estado === 'clave' ? 'La DIAN rechazó la clave: hay que cargar una nueva.' : motivoLegible(f.mensaje)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {clavesInvalidas > 0 && (
            <p className="text-xs text-[#434655] mt-2">
              Hay {clavesInvalidas} empresa{clavesInvalidas !== 1 ? 's' : ''} con clave inválida: no se reintentan solas para no bloquear la cuenta del cliente.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {faltaron.length > 0 && puedeGestionar && (
              <button
                onClick={() => revisarTodas(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition active:scale-[0.97]"
                style={{ background: '#003B43' }}
                title="Vuelve a revisar solo las que no tienen revisión de hoy"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>replay</span>
                Reintentar las que faltaron
              </button>
            )}
            <button onClick={() => setTab('errores')} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#d1d5db] text-[#434655] bg-white hover:bg-[#f3f4f6] transition">
              Ver los errores
            </button>
          </div>
        </div>
      )}

      {/* ── Filtro por estado ───────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 mb-6 border-b border-[#e2e4ef]">
      <div className="flex items-center gap-6 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative pb-3 text-sm whitespace-nowrap transition ${
              tab === key ? 'font-bold text-[#003B43]' : 'font-semibold text-[#9ca3af] hover:text-[#434655]'
            }`}
          >
            {label}
            <span className="ml-1.5 text-xs tabular-nums text-[#9ca3af]">{count}</span>
            {tab === key && <span className="absolute left-0 right-0 -bottom-px h-[2.5px] rounded-full" style={{ background: '#E5A70C' }} />}
          </button>
        ))}
      </div>

      {/* «Al día»: marcar todas como revisadas, en la misma fila de pestañas para que la lista no se mueva */}
      {tab === 'aldia' && puedeGestionar && sinMarcarAlDia.length > 0 && (
        <div className="flex items-center gap-2 pb-1.5 flex-shrink-0">
          {confirmandoMasivo ? (
            <>
              <span className="text-xs text-[#434655] hidden sm:inline">
                ¿Marcar {sinMarcarAlDia.length} empresa{sinMarcarAlDia.length !== 1 ? 's' : ''}?
              </span>
              <button
                onClick={() => marcarTodasRevisadas(sinMarcarAlDia)}
                disabled={marcandoMasivo}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition active:scale-[0.97]"
                style={{ background: '#003B43' }}
              >
                {marcandoMasivo ? 'Marcando…' : 'Sí, marcar'}
              </button>
              <button onClick={() => setConfirmandoMasivo(false)} disabled={marcandoMasivo} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#434655] hover:bg-[#f3f4f6] transition">Cancelar</button>
            </>
          ) : (
            <button
              onClick={() => setConfirmandoMasivo(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#003B43] bg-[#E3EEEE] hover:bg-[#d3e4e4] transition active:scale-[0.97] whitespace-nowrap"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>done_all</span>
              Marcar todas como revisadas ({sinMarcarAlDia.length})
            </button>
          )}
        </div>
      )}
      </div>

      {/* ── Lista ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#e2e4ef] shadow-sm overflow-hidden">
        {filtradas.length === 0 ? (
          <p className="text-sm text-[#9ca3af] italic px-5 py-8 text-center">Ninguna empresa coincide</p>
        ) : (
          <table className="w-full text-sm border-collapse table-fixed">
            <thead>
              <tr className="bg-[#f8f9fc] border-b border-[#e2e4ef] text-left text-[12px] font-bold text-[#434655] uppercase tracking-wide">
                <th className="px-5 py-2.5 font-bold w-[46%]">Empresa</th>
                <th className="px-3 py-2.5 font-bold w-32">Estado</th>
                <th className="px-3 py-2.5 font-bold">Deuda</th>
                <th className="px-3 py-2.5 font-bold w-[104px]">Consultada</th>
                <th className="px-3 py-2.5 font-bold w-[84px] text-center">Revisada</th>
                <th className="px-3 py-2.5 font-bold w-[132px]"></th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f8]">
              {filtradas.map((e) => {
                const est = ESTADOS[e.estado] ?? ESTADOS.pendiente
                const abierto = abiertoId === e.id
                const ocupada = revisando.has(e.id) || (loteEnCurso && progreso.empresasActuales?.includes(e.name))
                const puedeRevisar = puedeEditar && esMesActual && e.tieneClave && e.claveEstado !== 'invalida'
                const hayDetalle = e.detalle.length > 0 || !!e.mensaje || !!e.ultimoFalloAt || esClaveInvalida(e)
                const porRevisar = e.detalle.some((d) => d.estado === 'revisar')
                const { vencido, porVencer } = totalesDeuda(e.detalle)

                return (
                  <Fragment key={e.id}>
                    <tr
                      onClick={() => hayDetalle && setAbiertoId(abierto ? null : e.id)}
                      className={`group transition ${hayDetalle ? 'cursor-pointer' : ''} ${abierto ? 'bg-[#003B43]/10' : 'hover:bg-[#f3f4f6]'}`}
                    >
                      <td className={`relative px-5 py-3 border-l-4 ${abierto ? 'border-[#003B43]' : 'border-transparent'}`}>
                        <p className="font-semibold text-[#191c1e] truncate">{e.name}</p>
                        <CopiarDatosDian empresa={e} clave={claves[e.id]} mostrarClave={mostrarClaves} />
                        <ComentarioBoton
                          comentario={e.comentario}
                          puedeEditar={puedeGestionar && esMesActual}
                          abierto={comentarioAbierto === e.id}
                          onClick={() => setComentarioAbierto(comentarioAbierto === e.id ? null : e.id)}
                        />
                        {comentarioAbierto === e.id && (
                          <ComentarioPanel
                            empresa={e}
                            puedeEditar={puedeGestionar && esMesActual}
                            onGuardar={guardarComentario}
                            onCerrar={() => setComentarioAbierto(null)}
                          />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap" style={{ background: est.bg, color: est.color }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{est.icon}</span>
                            {est.label}
                          </span>
                          {esClaveInvalida(e) && e.estado !== 'clave' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap" style={{ background: ESTADOS.clave.bg, color: ESTADOS.clave.color }} title="La DIAN rechazó la clave: hay que cargar una nueva">
                              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{ESTADOS.clave.icon}</span>
                              Clave inválida
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-start gap-0.5 leading-tight">
                          {vencido > 0 && <span className="text-sm font-bold text-[#dc2626]">{pesos(vencido)}</span>}
                          {porVencer > 0 && <span className="text-xs font-semibold text-[#6b7280]" title="Aún no vencido: no causa intereses todavía">{pesos(porVencer)} por vencer</span>}
                          {porRevisar && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fffbeb', color: '#b45309' }}>Revisar pago</span>}
                          {e.estado === 'clave' && <span className="text-xs text-[#b45309]">Cargar una clave nueva</span>}
                          {e.estado === 'error' && <span className="text-xs text-[#b45309] line-clamp-2" title={e.mensaje ?? ''}>{motivoLegible(e.mensaje)}</span>}
                          {e.ultimoFalloAt && e.estado !== 'error' && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fffbeb', color: '#b45309' }} title={motivoLegible(e.ultimoFalloMensaje)}>
                              Reintento falló: dato anterior
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-[#6b7280]">
                        <div className="flex items-center gap-1">
                          {e.revisadoAt
                            ? (esMesActual && ['al_dia', 'con_deuda'].includes(e.estado) && !esDeHoy(e.revisadoAt)
                              ? <span className="font-semibold text-[#b45309]" title="Revisión de un día anterior: no se pudo repetir hoy">{fechaHora(e.revisadoAt)}</span>
                              : fechaHora(e.revisadoAt))
                            : <span className="text-[#c3c6d7]">—</span>}
                          {e.ultimoFalloAt && e.estado !== 'error' && (
                            <span className="material-symbols-outlined text-[#b45309]" style={{ fontSize: 15 }} title={`El último intento (${fechaHora(e.ultimoFalloAt)}) falló: esta fecha es de la revisión anterior`}>warning</span>
                          )}
                          {e.correoEnviadoAt && (
                            <span className="material-symbols-outlined text-[#16a34a]" style={{ fontSize: 15 }} title={`Correo enviado ${fechaHora(e.correoEnviadoAt)}`}>mark_email_read</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center" onClick={(ev) => ev.stopPropagation()}>
                        <ChulitoRevisada
                          marcada={!!e.marcadaRevisadaAt}
                          disabled={!puedeGestionar || !e.revisionId}
                          onClick={() => marcarRevisada(e)}
                          title={
                            !puedeGestionar ? 'Solo quien gestiona Deudas DIAN puede marcarla'
                              : !e.revisionId ? 'Primero hay que revisar la empresa'
                              : e.marcadaRevisadaAt ? `Marcada por ${e.marcadaRevisadaPor ?? '—'} el ${fechaHora(e.marcadaRevisadaAt)}`
                              : 'Marcar como revisada'
                          }
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap" onClick={(ev) => ev.stopPropagation()}>
                        {puedeRevisar ? (
                          <button
                            onClick={() => revisar(e)}
                            disabled={ocupada}
                            className="flex items-center justify-center gap-1.5 w-[116px] px-3 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-60 transition active:scale-[0.96]"
                            style={{ background: '#003B43' }}
                            title="Entrar a la DIAN y revisar las deudas (tarda ~10–30 s)"
                          >
                            {ocupada ? <><Spinner size={14} /> Revisando</> : 'Revisar'}
                          </button>
                        ) : (!e.tieneClave || e.claveEstado === 'invalida') && (
                          <Link
                            to={`/empresas?buscar=${encodeURIComponent(e.name)}`}
                            className="flex items-center justify-center gap-1 w-[116px] px-3 py-2 rounded-full text-sm font-semibold border border-[#d1d5db] text-[#6b7280] hover:bg-[#f3f4f6] transition"
                            title="La clave DIAN se carga en el Directorio de empresas"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>key</span>
                            {e.claveEstado === 'invalida' ? 'Nueva clave' : 'Clave'}
                          </Link>
                        )}
                      </td>
                      <td className="px-3 text-right">
                        {hayDetalle && (
                          <span className="material-symbols-outlined text-[#9ca3af]" style={{ fontSize: 20 }}>{abierto ? 'expand_less' : 'expand_more'}</span>
                        )}
                      </td>
                    </tr>
                    {abierto && hayDetalle && (
                      <tr>
                        <td colSpan={7} className="bg-[#fafbff] border-l-4 border-[#003B43] px-5 py-5">
                          <DetalleEmpresa
                            empresa={e}
                            puedeEditar={puedeEditar}
                            esMesActual={esMesActual}
                            onResolver={resolver}
                            onCorreo={() => setCorreoDe(e.id)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {empresaCorreo?.revisionId && (
        <CorreoModal
          empresa={empresaCorreo}
          onClose={() => setCorreoDe(null)}
          onCambio={() => cargar({ silencioso: true })}
        />
      )}
      {loteAbierto && <LoteModal empresas={empresas} onClose={() => setLoteAbierto(false)} onConfirmar={revisarTodas} />}
    </div>
  )
}
