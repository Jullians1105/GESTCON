import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Modal } from '../components/ClaveDianModal'
import Cargando from '../components/Cargando'
import { normalizarBusqueda, contiene } from '../utils/busqueda'

// Acuses: hasta qué día quedaron actualizados los acuses de recibo de cada cliente. Reemplaza el Excel
// "listadoAcuseActualizado", así que conserva sus 3 listas (Contable, Tributario y Externas) lado a lado, y toma el
// aspecto de Seguimiento mensual (Fondo Emprender): título con subtítulo, tarjeta de «Progreso general», pestañas en
// píldora y celdas como fichas suaves con ícono de color. Cada empresa tiene UNA celda: el color es el estado y
// adentro va la fecha («hasta qué día quedó»). Al hacer clic en la celda sale el mismo menú que en Seguimiento mensual: estado, nota y,
// además, un calendario para la fecha. Si hay nota, la celda lleva el puntito amarillo y la nota sale al pasar el
// mouse, igual que en Seguimiento mensual. Los 3 eventos se hacen al mismo tiempo, así que es una sola fecha por
// empresa; si algo no se pudo, va en la nota. Varias personas editan a la vez y queda quién y cuándo.
// Ver backend/controllers/acusesController.js (migración 077).

const AREAS = [
  { key: 'contable', label: 'Contable' },
  { key: 'tributario', label: 'Tributario' },
  { key: 'externas', label: 'Externas' },
]

// Colores e íconos de Seguimiento mensual (STATUS en data/empresasExternas.js): verde = hecho, ámbar = en proceso,
// azul cielo = N/A, gris = pendiente; el rojo es el de la app. `color` es el del ícono y el texto; `bg` el de la ficha.
const ESTADOS = {
  al_dia:         { label: 'Al día',         icon: 'check_circle',           color: '#16a34a', bg: '#dcfce7' },
  con_pendientes: { label: 'Con pendientes', icon: 'timelapse',              color: '#d97706', bg: '#fef9c3' },
  no_se_puede:    { label: 'No se puede',    icon: 'cancel',                 color: '#dc2626', bg: '#fee2e2' },
  no_hacer:       { label: 'No hacer',       icon: 'do_not_disturb_on',      color: '#0ea5e9', bg: '#e0f2fe' },
  pendiente:      { label: 'Sin hacer',      icon: 'radio_button_unchecked', color: '#6b7280', bg: '#f3f4f6' },
}
const ORDEN_ESTADOS = ['al_dia', 'con_pendientes', 'no_se_puede', 'no_hacer', 'pendiente']
const PIDE_MOTIVO = new Set(['no_se_puede', 'no_hacer', 'con_pendientes'])

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
// «24 jun»: siempre día + 3 letras (el formato del navegador da «24 de jun» o «30 de sept», que no cabe en la celda).
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fechaCorta = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? `${Number(m[3])} ${MESES_CORTOS[Number(m[2]) - 1]}` : ''
}
const fechaLarga = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? `${Number(m[3])} ${MESES_CORTOS[Number(m[2]) - 1]} ${m[1]}` : ''
}
// «hacer hasta» (p. ej. sep): a esas empresas solo se les hace hasta ese mes y luego se quitan. Cumplida = ya se hizo hasta ese día.
const mesDe = (iso) => { const m = /^\d{4}-(\d{2})/.exec(iso || ''); return m ? MESES_CORTOS[Number(m[1]) - 1] : '' }
const metaCumplida = (e) => !!e.hacerHasta && !!e.hasta && e.hasta >= e.hacerHasta
const aISO = (a, m, d) => `${a}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const hoyISO = () => new Date().toLocaleDateString('en-CA')
// «26 oct, 15:07»: formato fijo y corto (el del navegador da «26 de oct, 03:07 p. m.» y se parte en dos líneas).
const fechaHora = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const esDeHoy = (iso) => !!iso && new Date(iso).toDateString() === new Date().toDateString()

// Puntito amarillo de «tiene nota», idéntico al de Seguimiento mensual.
const PuntoNota = ({ tam = 7 }) => (
  <span className="absolute bg-amber-400 rounded-full border border-white" style={{ width: tam, height: tam, top: 2, right: 2 }} />
)

// ── Calendario del menú ───────────────────────────────────────────────────────
function Calendario({ valor, deshabilitado, onElegir }) {
  const inicial = /^(\d{4})-(\d{2})/.exec(valor || '') ?? /^(\d{4})-(\d{2})/.exec(hoyISO())
  const [anio, setAnio] = useState(Number(inicial[1]))
  const [mes, setMes] = useState(Number(inicial[2]) - 1)
  const hoy = hoyISO()

  // Si la fecha cambia (p. ej. con «Hoy» estando en otro mes), el calendario va al mes de la fecha nueva para que se vea marcada.
  useEffect(() => {
    const m = /^(\d{4})-(\d{2})/.exec(valor || '')
    if (m) { setAnio(Number(m[1])); setMes(Number(m[2]) - 1) }
  }, [valor])

  const huecos = (new Date(anio, mes, 1).getDay() + 6) % 7 // la semana empieza el lunes
  const dias = new Date(anio, mes + 1, 0).getDate()
  const mover = (d) => {
    const f = new Date(anio, mes + d, 1)
    setAnio(f.getFullYear()); setMes(f.getMonth())
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <button onClick={() => mover(-1)} className="p-0.5 rounded hover:bg-[#f3f4f6] text-[#6b7280] transition"><span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span></button>
        <span className="text-xs font-semibold text-[#191c1e]">{MESES[mes]} {anio}</span>
        <button onClick={() => mover(1)} className="p-0.5 rounded hover:bg-[#f3f4f6] text-[#6b7280] transition"><span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-[#9ca3af] mb-0.5">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: huecos }).map((_, i) => <span key={`h${i}`} />)}
        {Array.from({ length: dias }, (_, i) => i + 1).map((d) => {
          const iso = aISO(anio, mes, d)
          const elegido = iso === valor
          return (
            <button
              key={d}
              disabled={deshabilitado}
              onClick={() => onElegir(iso)}
              className={`h-6 text-[11px] rounded-md tabular-nums transition ${elegido ? 'bg-[#003B43] text-white font-bold' : 'text-[#191c1e] hover:bg-[#f3f4f6]'} ${iso === hoy && !elegido ? 'ring-1 ring-[#003B43]/50 font-semibold' : ''} disabled:cursor-default`}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Menú de la celda (como en Seguimiento mensual): estado, fecha y nota; todo se guarda solo ────────────────
const ETIQUETA = 'text-[10px] font-bold uppercase tracking-wide text-[#8890b5]'

function Menu({ empresa, pos, puedeEditar, onCambiarEstado, onCambiarHasta, onGuardarNota, onCerrar }) {
  const ref = useRef(null)
  const [nota, setNota] = useState(empresa.nota ?? '')
  const [top, setTop] = useState(pos.top)
  const sucia = useRef(false)
  // Valores vigentes para poder guardar al desmontarse (un clic afuera quita el menú antes de que el textarea dispare «blur»,
  // y por eso lo escrito se perdía: era el bug de las notas en Seguimiento mensual).
  const notaRef = useRef(nota)
  const empresaRef = useRef(empresa)
  const guardarRef = useRef(onGuardarNota)
  empresaRef.current = empresa
  guardarRef.current = onGuardarNota
  const guardarNota = useCallback(() => {
    if (!sucia.current) return
    sucia.current = false
    guardarRef.current(empresaRef.current, notaRef.current)
  }, [])
  useEffect(() => guardarNota, [guardarNota])

  // La altura real del menú no se sabe de antemano: se mide y, si se sale por abajo, se sube para que quepa.
  useLayoutEffect(() => {
    const alto = ref.current?.offsetHeight ?? 0
    setTop(Math.max(8, Math.min(pos.top, window.innerHeight - alto - 8)))
  }, [pos.top])

  useEffect(() => {
    const fuera = (ev) => { if (ref.current && !ref.current.contains(ev.target)) onCerrar('fuera') }
    const tecla = (ev) => { if (ev.key === 'Escape') onCerrar() }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla) }
  }, [onCerrar])

  const borrarNota = () => { sucia.current = false; notaRef.current = ''; setNota(''); onGuardarNota(empresa, '') }
  const motivo = PIDE_MOTIVO.has(empresa.estado)

  return (
    <div ref={ref} className="fixed z-50 bg-white border border-[#e2e4ef] rounded-xl shadow-2xl w-64 overflow-x-hidden overflow-y-auto" style={{ left: pos.left, top, maxHeight: 'calc(100vh - 16px)' }}>
      {/* Empresa */}
      <div className="px-4 pt-3.5 pb-3 border-b border-[#e2e4ef]">
        <p className="text-xs font-bold text-[#191c1e] truncate" title={empresa.nombre}>{empresa.nombre}</p>
        <p className="text-[10px] text-[#9ca3af] mt-0.5">
          {empresa.actualizadoPor ? <>Actualizó {empresa.actualizadoPor} · {fechaHora(empresa.actualizadoAt)}</> : 'Sin actualizaciones todavía'}
        </p>
      </div>

      {/* Estado: una columna, todos del mismo alto y con el texto alineado */}
      <div className="px-4 py-3 border-b border-[#e2e4ef]">
        <p className={`${ETIQUETA} mb-2`}>Estado</p>
        <div className="flex flex-col gap-1.5">
          {ORDEN_ESTADOS.map((k) => {
            const cfg = ESTADOS[k]
            const activo = empresa.estado === k
            return (
              <button
                key={k}
                disabled={!puedeEditar}
                onClick={() => { if (!activo) onCambiarEstado(empresa, k) }}
                className="h-8 flex items-center gap-2.5 px-2.5 rounded-lg text-xs font-semibold text-left transition-all hover:brightness-95 active:scale-[0.98] disabled:cursor-default"
                style={{ background: activo ? cfg.bg : 'transparent', color: cfg.color, border: `1.5px solid ${activo ? cfg.color : '#e2e4ef'}` }}
              >
                <span className="material-symbols-outlined w-[18px] text-center" style={{ fontSize: 16 }}>{cfg.icon}</span>
                <span className="flex-1 whitespace-nowrap">{cfg.label}</span>
                {activo && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Fecha */}
      <div className="px-4 py-3 border-b border-[#e2e4ef]">
        <div className="flex items-center justify-between mb-2 h-4">
          <p className={ETIQUETA}>Actualizada hasta</p>
          <span className="text-[11px] font-semibold text-[#191c1e]">{empresa.hasta ? fechaLarga(empresa.hasta) : 'sin fecha'}</span>
        </div>
        {metaCumplida(empresa) && (
          <p className="text-[10px] mb-2 text-[#15803d] font-semibold">Meta cumplida (hasta {mesDe(empresa.hacerHasta)}): se puede quitar de la lista</p>
        )}
        <Calendario key={empresa.id} valor={empresa.hasta} deshabilitado={!puedeEditar} onElegir={(iso) => onCambiarHasta(empresa, iso)} />
        {puedeEditar && (
          <div className="flex items-center justify-between mt-2 h-4">
            <button onClick={() => onCambiarHasta(empresa, hoyISO())} className="text-[11px] font-semibold text-[#003B43] hover:underline">Hoy</button>
            {empresa.hasta ? <button onClick={() => onCambiarHasta(empresa, null)} className="text-[11px] text-red-500 hover:text-red-600">Quitar fecha</button> : <span />}
          </div>
        )}
      </div>

      {/* Nota */}
      <div className="px-4 pt-3 pb-3">
        <p className={`${ETIQUETA} mb-2`}>{motivo ? 'Motivo' : 'Nota'}</p>
        <textarea
          value={nota}
          disabled={!puedeEditar}
          onChange={(ev) => { sucia.current = true; notaRef.current = ev.target.value; setNota(ev.target.value) }}
          onBlur={guardarNota}
          placeholder={motivo ? '¿Por qué no se pudo o qué falta?' : 'Nota opcional...'}
          rows={2}
          maxLength={1000}
          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#e2e4ef] bg-[#f8f9fc] text-[#191c1e] outline-none focus:ring-2 focus:ring-[#003B43]/30 resize-none disabled:opacity-60"
          style={{ minHeight: 52 }}
        />
      </div>

      {/* Pie: dos botones iguales */}
      <div className="grid grid-cols-2 border-t border-[#e2e4ef] divide-x divide-[#e2e4ef]">
        {puedeEditar ? (
          <button onClick={borrarNota} disabled={!nota.trim()} className="h-9 text-xs text-red-500 hover:bg-[#fef2f2] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">Borrar nota</button>
        ) : <span />}
        <button onClick={() => { guardarNota(); onCerrar() }} className="h-9 text-xs text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#191c1e] transition">Cerrar</button>
      </div>
    </div>
  )
}

function AgregarModal({ area, onClose, onCrear }) {
  const [nombre, setNombre] = useState('')
  const [fondo, setFondo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const etiqueta = AREAS.find((a) => a.key === area)?.label
  const crear = async () => {
    setGuardando(true)
    const ok = await onCrear({ area, nombre, fondo })
    setGuardando(false)
    if (ok) onClose()
  }
  return (
    <Modal onClose={onClose} ancho="max-w-sm">
      <h2 className="text-lg font-bold text-[#191c1e] mb-4">Agregar empresa · {etiqueta}</h2>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus placeholder="Nombre de la empresa" className="w-full mb-3 px-3 py-2 rounded-lg border border-[#d1d5db] text-sm focus:outline-none focus:border-[#003B43]" />
      <label className="flex items-center gap-2 text-sm text-[#191c1e] cursor-pointer select-none">
        <input type="checkbox" checked={fondo} onChange={(e) => setFondo(e.target.checked)} className="accent-[#003B43] w-4 h-4" />
        Fondo Emprender
      </label>
      <div className="flex items-center gap-2 mt-5">
        <button onClick={crear} disabled={guardando || !nombre.trim()} className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition active:scale-[0.97]" style={{ background: '#003B43' }}>
          {guardando ? 'Agregando…' : 'Agregar'}
        </button>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-[#434655] hover:bg-[#f3f4f6] transition">Cancelar</button>
      </div>
    </Modal>
  )
}

// ── Fila: nombre | ficha (color = estado, ícono y fecha adentro) ──────────────
function Fila({ empresa, abierta, onAbrir, onVerNota, onOcultarNota }) {
  const celda = useRef(null)
  const est = ESTADOS[empresa.estado] ?? ESTADOS.pendiente
  const nota = empresa.nota?.trim()
  const abrir = () => onAbrir(empresa, celda.current.getBoundingClientRect())
  return (
    <div className={`flex items-stretch border-b border-[#eef0f4] last:border-b-0 transition-colors ${abierta ? 'bg-[#eef5f3]' : 'hover:bg-[#f8f9fc]'}`}>
      <button onClick={abrir} className="flex-1 min-w-0 text-left px-3 py-[7px] text-[12.5px] font-semibold text-[#191c1e] truncate border-r border-[#d1d5db]" title={empresa.nombre}>
        {empresa.nombre}
        {empresa.programa && <span className="ml-2 text-[10px] font-semibold text-[#9ca3af]">{empresa.programa}</span>}
        {metaCumplida(empresa) && (
          <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#dcfce7] text-[#15803d]" title={`Ya se hizo hasta ${mesDe(empresa.hacerHasta)}: se puede quitar de la lista`}>
            listo · quitar
          </span>
        )}
      </button>
      <div className="flex items-center px-2 flex-shrink-0 bg-[#fafbfc]">
      <button
        ref={celda}
        onClick={abrir}
        onMouseEnter={nota ? (ev) => onVerNota(ev, nota) : undefined}
        onMouseLeave={nota ? onOcultarNota : undefined}
        title={nota ? undefined : est.label}
        aria-label={`${est.label}${empresa.hasta ? `, hasta ${fechaCorta(empresa.hasta)}` : ''}`}
        className="relative h-7 w-[88px] flex-shrink-0 rounded-lg flex items-center justify-center gap-1 text-[11px] font-semibold tabular-nums whitespace-nowrap transition-all hover:scale-105 active:scale-95"
        style={{ background: est.bg, color: est.color }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{est.icon}</span>
        <span className="w-[42px] text-center">{empresa.hasta ? fechaCorta(empresa.hasta) : '—'}</span>
        {nota && <PuntoNota />}
      </button>
      </div>
    </div>
  )
}

// ── Una lista (columna), con rejilla como en el Excel ────────────────────────
// `todas` son todas las de la lista (para el contador); `empresas` las que pasan la búsqueda.
function Lista({ area, todas, empresas, abiertaId, puedeEditar, onAbrir, onAgregar, onVerNota, onOcultarNota }) {
  const alDia = todas.filter((e) => e.estado === 'al_dia').length
  const grupos = [
    { clave: 'fondo', titulo: 'Fondo Emprender', lista: empresas.filter((e) => e.fondo) },
    { clave: 'otras', titulo: 'Otras', lista: empresas.filter((e) => !e.fondo) },
  ].filter((g) => g.lista.length > 0)
  // Como el «ACTUALES» del Excel: una columna angosta a la izquierda de los nombres con el rótulo vertical de Fondo Emprender.
  const conColumna = grupos.some((g) => g.clave === 'fondo')

  return (
    <section className="bg-white border border-[#e2e4ef] rounded-xl overflow-clip shadow-sm">
      <header className="flex items-center justify-between gap-2 px-3 py-2 bg-[#003B43] text-white">
        <h2 className="text-[13px] font-bold uppercase tracking-wide">{area.label}</h2>
        <span className="flex items-center gap-2 text-xs">
          <span className="tabular-nums text-white/80"><b className="text-white">{alDia}</b> de {todas.length} al día</span>
          {puedeEditar && (
            <button onClick={() => onAgregar(area.key)} title="Agregar empresa" className="p-0.5 rounded text-white/70 hover:bg-white/15 hover:text-white transition">
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>add</span>
            </button>
          )}
        </span>
      </header>
      {empresas.length === 0 && <p className="text-xs italic text-[#9ca3af] text-center py-6">Ninguna coincide</p>}
      {grupos.map((g) => (
        <div key={g.clave} className="flex items-stretch border-b border-[#d1d5db] last:border-b-0">
          {conColumna && (
            <div
              className={`w-6 flex-shrink-0 border-r border-[#d1d5db] flex items-start justify-center ${g.clave === 'fondo' ? 'bg-violet-100 text-violet-800' : 'bg-[#f8f9fc] text-[#9ca3af]'}`}
            >
              {/* sticky: el rótulo acompaña mientras se recorre una lista larga */}
              <span className="sticky top-24 py-4 text-[10px] font-bold uppercase tracking-[0.18em] whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                {g.clave === 'fondo' ? 'Fondo Emprender' : ''}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            {g.lista.map((e) => (
              <Fila key={e.id} empresa={e} abierta={abiertaId === e.id} onAbrir={onAbrir} onVerNota={onVerNota} onOcultarNota={onOcultarNota} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

export default function AcusesPage() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const puedeEditar = user?.role !== 'viewer'

  const [empresas, setEmpresas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [grupo, setGrupo] = useState('todas') // todas | fondo | otras
  const [menu, setMenu] = useState(null) // { id, left, top }
  const [agregandoEn, setAgregandoEn] = useState(null)
  const [tip, setTip] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const r = await api.getAcuses()
      setEmpresas(r.empresas)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los acuses')
    } finally {
      setCargando(false)
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])
  // Los cambios que hace otra persona aparecen solos: al volver a la ventana y cada minuto. No se refresca mientras hay un menú
  // abierto o un guardado en curso, para no pisar lo que se está escribiendo.
  useEffect(() => {
    const refrescar = async () => {
      if (document.hidden || menuId.current || pendientes.current > 0) return
      try {
        const r = await api.getAcuses()
        if (!menuId.current && pendientes.current === 0) setEmpresas(r.empresas)
      } catch { /* sin conexión: se intenta de nuevo después */ }
    }
    window.addEventListener('focus', refrescar)
    document.addEventListener('visibilitychange', refrescar)
    const t = setInterval(refrescar, 60000)
    return () => { window.removeEventListener('focus', refrescar); document.removeEventListener('visibilitychange', refrescar); clearInterval(t) }
  }, [])

  // Guardado de una empresa. Reglas para que nada «se quite solo» (bug de Seguimiento mensual):
  //  - Los guardados de una misma empresa salen EN ORDEN (cola): así el servidor los recibe como se hicieron.
  //  - El cambio se ve al instante y, cuando responde el servidor, solo se ajustan los campos que ESE guardado envió (más
  //    quién/cuándo). Nunca se reemplaza la fila entera con una respuesta que puede llegar vieja o desordenada.
  //  - Si falla, solo se deshacen esos campos (no lo que se hizo después).
  const cola = useRef(new Map())
  const pendientes = useRef(0)
  const actualizar = (empresa, cambios, optimista) => {
    const campos = Object.keys(optimista ?? {})
    const previos = Object.fromEntries(campos.map((k) => [k, empresa[k]]))
    const poner = (id, valores) => setEmpresas((lista) => lista.map((x) => (x.id === id ? { ...x, ...valores } : x)))
    if (optimista) poner(empresa.id, optimista)
    pendientes.current += 1
    const tarea = (cola.current.get(empresa.id) ?? Promise.resolve()).then(async () => {
      try {
        const r = await api.actualizarAcuse(empresa.id, cambios)
        const del = r.empresa
        poner(empresa.id, { ...Object.fromEntries(campos.map((k) => [k, del[k]])), actualizadoPor: del.actualizadoPor, actualizadoAt: del.actualizadoAt })
        return true
      } catch (err) {
        addToast(err.message || 'No se pudo guardar', 'error')
        poner(empresa.id, previos)
        return false
      } finally {
        pendientes.current -= 1
      }
    })
    cola.current.set(empresa.id, tarea)
    return tarea
  }
  const cambiarEstado = (e, estado) => actualizar(e, { estado }, { estado })
  const cambiarHasta = (e, hasta) => actualizar(e, { hasta }, { hasta })
  const guardarNota = (e, nota) => actualizar(e, { nota }, { nota: nota.trim() || null })

  const crear = async (datos) => {
    try {
      const r = await api.crearAcuse(datos)
      setEmpresas((lista) => [...lista, r.empresa])
      return true
    } catch (err) {
      addToast(err.message || 'No se pudo agregar', 'error')
      return false
    }
  }

  const menuId = useRef(null)
  const ultimoCierre = useRef({ id: null, t: 0 })
  const ALTO_MENU = 690
  const abrirMenu = (e, rect) => {
    // El clic que abre la celda ya cerró el menú anterior (clic «afuera»): si era la misma celda, no se reabre.
    if (ultimoCierre.current.id === e.id && Date.now() - ultimoCierre.current.t < 300) return
    const ancho = 256
    let left, top
    if (rect.bottom + 6 + ALTO_MENU <= window.innerHeight - 8) {
      left = Math.max(8, Math.min(rect.right - ancho, window.innerWidth - ancho - 12))
      top = rect.bottom + 6
    } else {
      // No cabe debajo: va al lado de la celda (a la izquierda, o a la derecha si no hay espacio) para NO taparla.
      left = rect.left - ancho - 8 >= 8 ? rect.left - ancho - 8 : Math.min(rect.right + 8, window.innerWidth - ancho - 8)
      top = Math.max(8, Math.min(rect.top - 40, window.innerHeight - ALTO_MENU - 8))
    }
    setTip(null)
    menuId.current = e.id
    setMenu({ id: e.id, left, top })
  }
  const cerrarMenu = useCallback((motivo) => {
    if (motivo === 'fuera') ultimoCierre.current = { id: menuId.current, t: Date.now() }
    menuId.current = null
    setMenu(null)
  }, [])
  const verNota = (ev, texto) => {
    const r = ev.currentTarget.getBoundingClientRect()
    setTip({ texto, left: Math.min(r.right + 6, window.innerWidth - 270), top: r.top })
  }

  const visibles = useMemo(() => {
    const q = normalizarBusqueda(busqueda)
    return empresas
      .filter((e) => (!q || contiene(e.nombre, q) || contiene(e.programa ?? '', q)) && (grupo === 'todas' || (grupo === 'fondo' ? e.fondo : !e.fondo)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [empresas, busqueda, grupo])

  const totales = useMemo(() => Object.fromEntries(ORDEN_ESTADOS.map((k) => [k, empresas.filter((e) => e.estado === k).length])), [empresas])

  // Seguimiento del día: cuántas se actualizaron hoy y quién (solo lo que hizo una persona, no la carga inicial).
  const hoy = useMemo(() => {
    const porPersona = {}
    empresas.filter((e) => e.actualizadoPor && esDeHoy(e.actualizadoAt)).forEach((e) => { porPersona[e.actualizadoPor] = (porPersona[e.actualizadoPor] ?? 0) + 1 })
    return { total: Object.values(porPersona).reduce((a, b) => a + b, 0), personas: Object.entries(porPersona).sort((a, b) => b[1] - a[1]) }
  }, [empresas])

  const abierta = menu ? empresas.find((e) => e.id === menu.id) : null

  if (cargando) return <Cargando texto="Cargando acuses…" />
  if (error) return (
    <div className="max-w-6xl mx-auto mt-20 flex flex-col items-center gap-3">
      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      <button onClick={cargar} className="px-4 py-2 text-sm rounded-xl border border-[#e2e4ef] hover:bg-[#f3f4f6] transition">Reintentar</button>
    </div>
  )

  const faltan = totales.pendiente + totales.con_pendientes + totales.no_se_puede
  const cumplidas = empresas.filter(metaCumplida).length
  const total = empresas.length
  const pct = total ? Math.round((totales.al_dia / total) * 100) : 0
  const pestanas = [
    { key: 'todas', label: 'Todas', n: total },
    { key: 'fondo', label: 'Fondo Emprender', n: empresas.filter((e) => e.fondo).length },
    { key: 'otras', label: 'Otras', n: empresas.filter((e) => !e.fondo).length },
  ]
  return (
    <div className="max-w-[1600px] mx-auto">
      {/* ── Encabezado (como Seguimiento mensual) ──────────────────────── */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-[#191c1e]">task_alt</span>
            <h1 className="text-2xl font-bold text-[#191c1e]">Acuses</h1>
          </div>
          <p className="text-sm text-[#6b7280] mt-0.5">Seguimiento de acuses de recibo · hasta qué día quedó cada empresa</p>
        </div>
        {cumplidas > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-3 py-2">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>task_alt</span>
            <b>{cumplidas}</b> ya cumplieron su meta «hacer hasta»: se pueden quitar
          </div>
        )}
        {hoy.total > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-[#6b7280] bg-white border border-[#e2e4ef] rounded-xl px-3 py-2 shadow-sm">
            Hoy se actualizaron <b className="text-[#191c1e]">{hoy.total}</b>
            {hoy.personas.map(([p, n]) => <span key={p} className="px-1.5 py-0.5 rounded bg-[#f3f4f6]">{p} · {n}</span>)}
          </div>
        )}
      </div>

      {/* ── Pestañas en píldora + buscador ─────────────────────────────── */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-1 bg-white border border-[#e2e4ef] rounded-xl p-1 shadow-sm">
          {pestanas.map((t) => (
            <button
              key={t.key}
              onClick={() => setGrupo(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${grupo === t.key ? 'bg-[#f3f4f6] text-[#191c1e]' : 'text-[#6b7280] hover:bg-[#f9fafb]'}`}
            >
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${grupo === t.key ? 'bg-[#003B43] text-white' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>{t.n}</span>
            </button>
          ))}
        </div>
        <div className="relative w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] text-lg">search</span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar empresa..."
            className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-[#e2e4ef] bg-white text-sm text-[#191c1e] focus:outline-none focus:ring-2 focus:ring-[#003B43]/30"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} title="Borrar búsqueda" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#434655] transition">
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>close</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Progreso general (como Seguimiento mensual) ────────────────── */}
      <div className="bg-white rounded-xl border border-[#e2e4ef] px-5 py-3.5 mb-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-xs font-semibold text-[#191c1e]">Progreso general</span>
          <span className="flex items-center gap-3">
            <span className="text-xs font-bold text-[#16a34a]">{pct}%</span>
            <span className="text-xs text-[#6b7280]"><b className="text-[#191c1e]">{totales.al_dia}</b> / {total} al día · <b className="text-[#c2410c]">{faltan}</b> faltan</span>
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-[#f3f4f6] overflow-hidden">
          <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#16a34a' }} />
        </div>
      </div>

      {/* ── Las 3 listas lado a lado, como el Excel ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {AREAS.map((a) => (
          <Lista
            key={a.key}
            area={a}
            todas={empresas.filter((e) => e.area === a.key)}
            empresas={visibles.filter((e) => e.area === a.key)}
            abiertaId={menu?.id}
            puedeEditar={puedeEditar}
            onAbrir={abrirMenu}
            onAgregar={setAgregandoEn}
            onVerNota={verNota}
            onOcultarNota={() => setTip(null)}
          />
        ))}
      </div>
      <div className="flex gap-5 flex-wrap items-center mt-4">
        {ORDEN_ESTADOS.map((k) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="material-symbols-outlined" style={{ color: ESTADOS[k].color, fontSize: 16 }}>{ESTADOS[k].icon}</span>
            <span className="text-xs text-[#6b7280]">{ESTADOS[k].label} <span className="tabular-nums text-[#9ca3af]">{totales[k]}</span></span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
          <span className="text-xs text-[#6b7280]">Tiene nota</span>
        </div>
      </div>
      <p className="text-[11px] text-[#9ca3af] mt-2">
        Clic en la ficha de una empresa: ahí eliges el estado, la fecha «hasta qué día quedó» en el calendario y dejas la nota.
      </p>

      {tip && (
        <div className="fixed z-[60] shadow-lg text-xs text-[#1f1f1f] pointer-events-none" style={{ left: tip.left, top: tip.top, width: 240, background: '#fffef7', border: '1px solid #c8b800', borderRadius: 3 }}>
          <p className="whitespace-pre-wrap break-words leading-relaxed p-2">{tip.texto}</p>
        </div>
      )}
      {abierta && (
        <Menu
          key={abierta.id}
          empresa={abierta}
          pos={menu}
          puedeEditar={puedeEditar}
          onCambiarEstado={cambiarEstado}
          onCambiarHasta={cambiarHasta}
          onGuardarNota={guardarNota}
          onCerrar={cerrarMenu}
        />
      )}
      {agregandoEn && <AgregarModal area={agregandoEn} onClose={() => setAgregandoEn(null)} onCrear={crear} />}
    </div>
  )
}
