import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { Users, Cpu, Activity, Clock, TrendingUp, AlertTriangle } from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalClients: 0, activeDevices: 0, pendingDevices: 0,
    offlineDevices: 0, pendingRequests: 0, pendingPayments: 0
  })

  useEffect(() => {
    setStats({
      totalClients: 3, activeDevices: 5, pendingDevices: 2,
      offlineDevices: 1, pendingRequests: 1, pendingPayments: 2
    })
  }, [])

  // Obtenemos la fecha actual para darle un toque más personal
  const today = new Intl.DateTimeFormat('es-GT', { 
    weekday: 'long', day: 'numeric', month: 'long' 
  }).format(new Date());

  const STAT_CARDS = [
    { label: 'Clientes activos', value: stats.totalClients, icon: Users, color: '#2BA8A0', bg: 'rgba(43, 168, 160, 0.1)' },
    { label: 'Dispositivos activos', value: stats.activeDevices, icon: Activity, color: '#67B7E8', bg: 'rgba(103, 183, 232, 0.12)' },
    { label: 'Equipos pendientes', value: stats.pendingDevices, icon: Clock, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' },
    { label: 'Sin conexión', value: stats.offlineDevices, icon: Cpu, color: '#8FA899', bg: 'rgba(143, 168, 153, 0.1)' },
    { label: 'Nuevas solicitudes', value: stats.pendingRequests, icon: TrendingUp, color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.1)' },
    { label: 'Pagos pendientes', value: stats.pendingPayments, icon: AlertTriangle, color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' },
  ]

  return (
    <AdminLayout>
      {/* Fondo Glow Premium - Más grande y suave */}
      <div 
        className="min-h-full py-4 lg:py-6 page-bg"
      >
        <div className="mb-10 flex flex-col gap-1">
          <p className="text-sm font-semibold capitalize tracking-wide" style={{ color: '#67B7E8' }}>
            {today}
          </p>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
            Hola de nuevo, Superadmin
          </h1>
          <p className="text-base mt-2" style={{ color: 'var(--text2)' }}>
            Acá tenés el resumen de lo que está pasando hoy en AirSunBox.
          </p>
        </div>
        {/* Tarjetas de Estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-10">
          {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
            <div 
              key={label} 
              className="group rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5" 
              style={{ 
                background: 'var(--card)', 
                border: '1px solid var(--border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: bg }}>
                  <Icon size={22} strokeWidth={2.5} style={{ color }} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-4xl lg:text-5xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
                  {value}
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text2)' }}>
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Paneles de Información Inferiores */}
        <div className="grid lg:grid-cols-2 gap-8">
          
          {/* Actividad Reciente */}
          <div className="rounded-3xl p-8" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}>
            <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Actividad reciente</h2>
            <div className="space-y-1">
              {[
                { msg: 'Municipalidad Xela registró un nuevo dispositivo', time: 'Hace 2 horas', color: '#2BA8A0' },
                { msg: 'Estación Centro perdió conexión', time: 'Hace 5 horas', color: '#F59E0B' },
                { msg: 'CUNOC registró un nuevo pago', time: 'Ayer', color: '#67B7E8' },
                { msg: 'Recibiste una nueva solicitud de dispositivo', time: 'Hace 2 días', color: '#A78BFA' },
              ].map((a, i) => (
                <div key={i} className="flex items-center gap-4 py-4 border-b last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] -mx-4 px-4 rounded-xl transition-colors" style={{ borderColor: 'var(--border)' }}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: a.color, boxShadow: `0 0 12px ${a.color}80` }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{a.msg}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagos Pendientes */}
          <div className="rounded-3xl p-8" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}>
            <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Próximos cobros</h2>
            <div className="space-y-1">
              {[
                { org: 'Municipalidad Xela', plan: 'Plan Pro', vence: '1 Jun 2026', dias: 3 },
                { org: 'Empresa Industrial S.A.', plan: 'Plan Pro', vence: '15 Jun 2026', dias: 17 },
              ].map((p, i) => (
                <div key={i} className="flex items-center justify-between py-4 border-b last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] -mx-4 px-4 rounded-xl transition-colors" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{p.org}</div>
                    <div className="text-xs mt-1 font-medium" style={{ color: 'var(--text2)' }}>{p.plan} · Vence el {p.vence}</div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${p.dias <= 5 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    Faltan {p.dias} días
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  )
}