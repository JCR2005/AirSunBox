import ClienteLayout from '../components/sanik/ClienteLayout'
import useAuthStore from '../store/auth'
import { User, Building2, Mail, Shield, Calendar } from 'lucide-react'

export default function Profile() {
  const { user, org } = useAuthStore()
  
  const today = new Intl.DateTimeFormat('es-GT', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  }).format(new Date());

  return (
    <ClienteLayout>
      <div className="p-6 lg:p-10 max-w-4xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
            Mi Perfil
          </h1>
          <p className="text-base mt-2" style={{ color: 'var(--text2)' }}>
            Gestiona la información de tu cuenta y organización.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          
          {/* Tarjeta de Usuario */}
          <div className="md:col-span-1">
             <div className="rounded-3xl p-8 border text-center relative overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                {/* Glow decorativo */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#67B7E8] to-transparent opacity-50" />
                
                <div className="w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center text-3xl font-bold shadow-lg" style={{ background: 'rgba(103,183,232,0.12)', color: '#67B7E8' }}>
                  {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                </div>
                
                <h2 className="text-xl font-bold truncate" style={{ color: 'var(--text)' }}>
                  {user?.name || 'Usuario'}
                </h2>
                <p className="text-sm font-medium mt-1 mb-6" style={{ color: 'var(--text2)' }}>
                  {user?.email}
                </p>
                
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider" style={{ background: 'rgba(103,183,232,0.1)', color: '#67B7E8' }}>
                  <Shield size={14} /> {user?.role || 'Cliente'}
                </div>
             </div>
          </div>

          {/* Información Detallada */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Organización */}
            <div className="rounded-3xl p-8 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-6 flex items-center gap-2" style={{ color: 'var(--text2)' }}>
                <Building2 size={16} /> Organización Asociada
              </h3>
              
              <div className="grid gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-black/5 dark:bg-white/5" style={{ color: 'var(--text)' }}>
                    <Building2 size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Nombre</div>
                    <div className="text-lg font-bold" style={{ color: 'var(--text)' }}>{org?.name || 'No registrada'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-black/5 dark:bg-white/5" style={{ color: 'var(--text)' }}>
                    <Shield size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Plan de Servicio</div>
                    <div className="text-lg font-bold capitalize" style={{ color: 'var(--text)' }}>{org?.plan || 'Free'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-black/5 dark:bg-white/5" style={{ color: 'var(--text)' }}>
                    <Calendar size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Miembro desde</div>
                    <div className="text-lg font-bold" style={{ color: 'var(--text)' }}>{today}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Seguridad (Placeholder) */}
            <div className="rounded-3xl p-8 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--text2)' }}>
                <Mail size={16} /> Contacto & Soporte
              </h3>
              <p className="text-sm" style={{ color: 'var(--text2)' }}>
                Si necesitas cambiar tu correo o actualizar los datos de tu organización, por favor contacta al equipo de Sanik.
              </p>
              <button className="mt-6 px-6 py-3 rounded-xl text-sm font-bold border transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                Contactar Soporte
              </button>
            </div>

          </div>

        </div>
      </div>
    </ClienteLayout>
  )
}
