import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { Users, Cpu, Activity, TrendingUp, FileText, CalendarClock, LifeBuoy } from 'lucide-react'
import useAuthStore from '../../store/auth'
import { reports, requests as requestsApi, organizations as orgsApi, incidents as incidentsApi } from '../../services/api'
import { INCIDENT_STATUS } from '../ClientIncidents'

const STATUS_LABEL = {
  pending: { label: 'Pendiente', color: '#F59E0B' },
  in_review: { label: 'En revisión', color: '#67B7E8' },
  approved: { label: 'Aprobada', color: '#2CB67D' },
  rejected: { label: 'Rechazada', color: '#EF4444' },
}

const DAY_MS = 24 * 60 * 60 * 1000

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime()
  const min = Math.round(diff / 60000)
  if (min < 60) return min <= 1 ? 'Hace un momento' : `Hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `Hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'Ayer' : `Hace ${d} días`
}

function Panel({ title, Icon, children }) {
  return (
    <div className="rounded-3xl p-8" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}>
      <h2 className="font-display text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--text)' }}>
        <Icon size={18} style={{ color: '#67B7E8' }} /> {title}
      </h2>
      {children}
    </div>
  )
}

function Empty({ children }) {
  return <p className="text-sm py-6 text-center" style={{ color: 'var(--text2)' }}>{children}</p>
}

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState(null)
  const [recentRequests, setRecentRequests] = useState(null)
  const [dueOrgs, setDueOrgs] = useState(null)
  const [openIncidents, setOpenIncidents] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    // Cada bloque carga por separado: si uno falla (p. ej. un rol sin acceso a
    // organizaciones), los demás se muestran igual.
    reports.getGlobalStats()
      .then(s => active && setStats(s))
      .catch(e => active && setError(e.message || 'No se pudieron cargar las estadísticas'))
    requestsApi.list()
      .then(r => active && setRecentRequests((r || []).slice(0, 5)))
      .catch(() => active && setRecentRequests([]))
    incidentsApi.list()
      .then(i => active && setOpenIncidents((i || []).filter(x => x.status !== 'resolved')))
      .catch(() => active && setOpenIncidents([]))
    orgsApi.list()
      .then(orgs => {
        if (!active) return
        // Vencimientos reales: organizaciones que pagan, con fecha, ordenadas
        const due = (orgs || [])
          .filter(o => o.paid_until && !o.payment_exempt && o.status !== 'suspended')
          .map(o => ({ id: o.id, name: o.name, plan: o.plan, paidUntil: o.paid_until,
                       days: Math.ceil((new Date(o.paid_until).getTime() - Date.now()) / DAY_MS) }))
          .filter(o => o.days <= 30)
          .sort((a, b) => a.days - b.days)
          .slice(0, 5)
        setDueOrgs(due)
      })
      .catch(() => active && setDueOrgs([]))
    return () => { active = false }
  }, [])

  const today = new Intl.DateTimeFormat('es-GT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const name = (user?.name || user?.email?.split('@')[0] || '').split(' ')[0]

  const total = Number(stats?.total_devices ?? 0)
  const activeNow = Number(stats?.active_devices ?? 0)
  const STAT_CARDS = [
    { label: 'Clientes', value: stats?.total_clients, icon: Users, color: '#2BA8A0', bg: 'rgba(43, 168, 160, 0.1)' },
    { label: `Estaciones activas de ${total}`, value: stats ? activeNow : undefined, icon: Activity, color: '#67B7E8', bg: 'rgba(103, 183, 232, 0.12)' },
    { label: 'Estaciones sin conexión', value: stats ? total - activeNow : undefined, icon: Cpu, color: '#8FA899', bg: 'rgba(143, 168, 153, 0.1)' },
    { label: 'Solicitudes pendientes', value: stats?.pending_requests, icon: TrendingUp, color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.1)' },
  ]

  return (
    <AdminLayout>
      <div className="min-h-full py-4 lg:py-6 page-bg">
        <div className="mb-10 flex flex-col gap-1">
          <p className="text-sm font-semibold capitalize tracking-wide" style={{ color: '#67B7E8' }}>{today}</p>
          <h1 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
            {greeting}{name ? `, ${name}` : ''}
          </h1>
          <p className="text-base mt-2" style={{ color: 'var(--text2)' }}>
            El estado de AirSunBox ahora mismo.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-6 rounded-xl px-5 py-4 text-sm font-medium" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 mb-10">
          {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-3xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ background: bg }}>
                <Icon size={22} strokeWidth={2.5} style={{ color }} />
              </div>
              <div className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
                {value ?? <span className="inline-block w-12 h-10 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />}
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text2)' }}>{label}</span>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <Panel title="Solicitudes recientes" Icon={FileText}>
            {recentRequests === null ? <Empty>Cargando…</Empty>
              : recentRequests.length === 0 ? <Empty>No hay solicitudes.</Empty>
              : (
                <div className="space-y-1">
                  {recentRequests.map(r => {
                    const st = STATUS_LABEL[r.status] || { label: r.status, color: '#8FA899' }
                    return (
                      <Link key={r.id} to="/admin/solicitudes" className="flex items-center gap-4 py-4 border-b last:border-0 -mx-4 px-4 rounded-xl transition-colors hover:bg-black/[0.02]" style={{ borderColor: 'var(--border)' }}>
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: st.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                            {r.org_name} · {r.device_name || 'Estación'}{r.quantity > 1 ? ` (×${r.quantity})` : ''}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>{timeAgo(r.created_at)}</p>
                        </div>
                        <span className="text-xs font-bold" style={{ color: st.color }}>{st.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
          </Panel>

          <Panel title={`Incidencias pendientes${openIncidents?.length ? ` (${openIncidents.length})` : ''}`} Icon={LifeBuoy}>
            {openIncidents === null ? <Empty>Cargando…</Empty>
              : openIncidents.length === 0 ? <Empty>No hay incidencias pendientes.</Empty>
              : (
                <div className="space-y-1">
                  {openIncidents.slice(0, 5).map(i => {
                    const st = INCIDENT_STATUS[i.status] || { label: i.status }
                    return (
                      <Link key={i.id} to="/admin/incidencias" className="flex items-center gap-4 py-4 border-b last:border-0 -mx-4 px-4 rounded-xl transition-colors hover:bg-black/[0.02]" style={{ borderColor: 'var(--border)' }}>
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: i.status === 'open' ? '#F59E0B' : '#67B7E8' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                            {i.org_name} · {i.device_name || 'General'}
                          </p>
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text2)' }}>{timeAgo(i.created_at)} · {i.reason}</p>
                        </div>
                        <span className="text-xs font-bold" style={{ color: i.status === 'open' ? '#F59E0B' : '#67B7E8' }}>{st.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
          </Panel>

          <Panel title="Próximos cobros" Icon={CalendarClock}>
            {dueOrgs === null ? <Empty>Cargando…</Empty>
              : dueOrgs.length === 0 ? <Empty>Ningún cliente vence en los próximos 30 días.</Empty>
              : (
                <div className="space-y-1">
                  {dueOrgs.map(o => (
                    <Link key={o.id} to={`/admin/clientes/${o.id}`} className="flex items-center justify-between py-4 border-b last:border-0 -mx-4 px-4 rounded-xl transition-colors hover:bg-black/[0.02]" style={{ borderColor: 'var(--border)' }}>
                      <div>
                        <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{o.name}</div>
                        <div className="text-xs mt-1 font-medium" style={{ color: 'var(--text2)' }}>
                          {o.plan ? `Plan ${o.plan} · ` : ''}Vence el {new Date(o.paidUntil).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${o.days <= 5 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        {o.days < 0 ? `Vencido hace ${-o.days} d` : o.days === 0 ? 'Vence hoy' : `Faltan ${o.days} días`}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
          </Panel>
        </div>
      </div>
    </AdminLayout>
  )
}
