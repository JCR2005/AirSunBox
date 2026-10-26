import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/auth'
import Landing from './pages/Landing'
import PublicMap from './pages/PublicMap'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Devices from './pages/Devices'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import Profile from './pages/Profile'
import AdminDashboard from './pages/admin/Dashboard'
import AdminClients from './pages/admin/Clients'
import AdminClientDetail from './pages/admin/ClientDetail'
import AdminDeviceDetail from './pages/admin/DeviceDetail'
import AdminTeam from './pages/admin/Team'
import AdminVariables from './pages/admin/Variables'
import AdminRequests from './pages/admin/Requests'
import ClientDeviceDetail from './pages/DeviceDetail'
import Reports from './pages/Reports'
import GlobalReports from './pages/GlobalReports'
import VariableDetail from './pages/VariableDetail'
import Spaces from './pages/Spaces'
import SpaceDetail from './pages/SpaceDetail'
import SpaceAqi from './pages/SpaceAqi'
const ADMIN_ROLES = ['admin', 'superadmin', 'worker']

/**
 * Componente genérico para proteger rutas.
 * @param {Array} allowedRoles - Roles que pueden acceder. Si se omite, basta con estar autenticado.
 * @param {string} redirectTo - Ruta a la que redirigir si no tiene permisos (por defecto /login o /devices).
 */
function ProtectedRoute({ children, allowedRoles, redirectTo }) {
  const { token, user, org } = useAuthStore()

  // 1. Si no hay token, al login siempre
  if (!token) {
    return <Navigate to="/login" replace />
  }

  // 2. Si hay roles permitidos definidos, verificar
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirección inteligente según el rol
    const defaultRedirect = ADMIN_ROLES.includes(user?.role)
      ? '/admin'
      : (org?.type === 'B' ? '/espacios' : '/dispositivos')
    return <Navigate to={redirectTo || defaultRedirect} replace />
  }

  return children
}

/**
 * Componente para rutas que SOLO pueden verse si NO estás logueado (Landing, Login).
 */
function PublicRoute({ children }) {
  const { token, user, org } = useAuthStore()

  if (token) {
    const dashboard = ADMIN_ROLES.includes(user?.role)
      ? '/admin'
      : (org?.type === 'B' ? '/espacios' : '/dispositivos')
    return <Navigate to={dashboard} replace />
  }
  return children
}

/**
 * Componente para switchear secciones según el tipo de organización cliente:
 * · B (independiente)  → gestiona sus espacios (cada espacio contiene sus estaciones)
 * · A (dependiente)    → gestiona sus estaciones directas
 * Si alguien entra a la ruta que no le corresponde, se redirige a la suya.
 */
function ClientScopeRoute({ isEspacios, children }) {
  const { token, user, org } = useAuthStore()

  if (!token) return <Navigate to="/login" replace />
  if (!['client'].includes(user?.role)) return <Navigate to="/admin" replace />

  const isB = org?.type === 'B'
  if (isEspacios && !isB) return <Navigate to="/dispositivos" replace />
  if (!isEspacios && isB) return <Navigate to="/espacios" replace />

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/"      element={<PublicRoute><Landing /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
        <Route path="/mapa"  element={<PublicRoute><PublicMap /></PublicRoute>} />
        <Route path="/reportes-globales" element={<GlobalReports />} />
        {/* --- RUTAS EXCLUSIVAS DE CLIENTES (CORREGIDAS) --- */}
        <Route path="/variableDetail/:deviceId/:variableLabel" element={<ProtectedRoute allowedRoles={['client']}><VariableDetail /></ProtectedRoute>} />
        {/* ARREGLO 2: Ruta base del Dashboard agregada */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['client']}><Dashboard /></ProtectedRoute>} />
        
        {/* Ruta para ver el dashboard específico de 1 dispositivo (la que ya tenías) */}
        <Route path="/dashboard/:id" element={<ProtectedRoute allowedRoles={['client']}><Dashboard /></ProtectedRoute>} />
        
        <Route path="/devices/:id" element={<ProtectedRoute allowedRoles={['client']}><ClientDeviceDetail /></ProtectedRoute>} />
        {/* ARREGLO 3: Cambiamos /devices por /dispositivos para que encaje con tu menú lateral */}
        <Route path="/dispositivos" element={<ClientScopeRoute><Devices /></ClientScopeRoute>} />
        <Route path="/espacios" element={<ClientScopeRoute isEspacios><Spaces /></ClientScopeRoute>} />
        <Route path="/espacios/:id" element={<ClientScopeRoute isEspacios><SpaceDetail /></ClientScopeRoute>} />
        <Route path="/espacios/:id/aqi" element={<ClientScopeRoute isEspacios><SpaceAqi /></ClientScopeRoute>} />
        {/* <Route path="/devices"           element={<ProtectedRoute allowedRoles={['client']}><Devices /></ProtectedRoute>} /> */}

        <Route path="/alerts" element={<ProtectedRoute allowedRoles={['client']}><Alerts /></ProtectedRoute>} />
        <Route path="/alerts/:deviceId" element={<ProtectedRoute allowedRoles={['client']}><Alerts /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Rutas de Administración (Admin, Superadmin, Worker) */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={ADMIN_ROLES}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        <Route path="/admin/clientes" element={
          <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
            <AdminClients />
          </ProtectedRoute>
        } />

        <Route path="/admin/clientes/:clientId" element={
          <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
            <AdminClientDetail />
          </ProtectedRoute>
        } />

        <Route path="/admin/clientes/:clientId/dispositivo/:deviceId" element={
          <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
            <AdminDeviceDetail />
          </ProtectedRoute>
        } />

        <Route path="/admin/equipo" element={
          <ProtectedRoute allowedRoles={['superadmin']}>
            <AdminTeam />
          </ProtectedRoute>
        } />

        <Route path="/admin/variables" element={
          <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
            <AdminVariables />
          </ProtectedRoute>
        } />

        <Route path="/admin/solicitudes" element={
          <ProtectedRoute allowedRoles={ADMIN_ROLES}>
            <AdminRequests />
          </ProtectedRoute>
        } />

        <Route path="/reportes" element={
          <ProtectedRoute allowedRoles={['client']}>
            <Reports />
          </ProtectedRoute>
        } />

        {/* Comodín de redirección */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}