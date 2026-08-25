const BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api')

function getToken() {
  return localStorage.getItem('sanik_token') || localStorage.getItem('token')
}

async function request(path, options = {}) {
  let res
  try {
    const token = getToken()
    res = await fetch(`${BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': 'true', 
        'ngrok-skip-browser-warning': 'true', 
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...options
    })
  } catch (err) {
    throw new Error('No se pudo conectar con el servidor. Verifica que el backend esté activo.')
  }

  const contentType = res.headers.get('content-type') || ''
  const data = contentType && contentType.includes('application/json') ? await res.json() : null
  
  if (!res.ok) {
    throw new Error(data?.error || data?.message || 'Error del servidor')
  }
  return data
}

export const auth = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  me: () => request('/auth/me')
}

export const devices = {
  list: (orgId) => request(`/devices${orgId ? `?orgId=${orgId}` : ''}`),
  get: (id, orgId) => request(`/devices/${id}${orgId ? `?orgId=${orgId}` : ''}`),
  create: (data) => request('/devices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data, orgId) => request(`/devices/${id}${orgId ? `?orgId=${orgId}` : ''}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id, orgId) => request(`/devices/${id}${orgId ? `?orgId=${orgId}` : ''}`, { method: 'DELETE' }),
  variables: (id, orgId) => request(`/devices/${id}/variables${orgId ? `?orgId=${orgId}` : ''}`),
  lastValues: (id, orgId) => request(`/devices/${id}/last-values${orgId ? `?orgId=${orgId}` : ''}`),
  catalog: () => request('/devices/catalog'),
  aqi: (id, orgId) => request(`/devices/${id}/aqi${orgId ? `?orgId=${orgId}` : ''}`),
  
  
  listPublic: () => request('/public/devices'),
  aqiPublic:  (id)  => request(`/public/devices/${id}/aqi`),
  zonaAqi:    (ids) => request(`/public/zones/aqi?ids=${ids.join(',')}`)

}

export const variables = {
  list: (spaceId) => request(`/variables/catalog${spaceId ? `?spaceId=${spaceId}` : ''}`),
  create: (data) => request('/variables/catalog', { method: 'POST', body: JSON.stringify(data),  }),
  update: (label, data) => request(`/variables/catalog/${label}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (label) => request(`/variables/catalog/${label}`, { method: 'DELETE' }),
  getRanges: (label, orgId) => request(`/variables/ranges/${label}${orgId ? `?orgId=${orgId}` : ''}`)
}

export const dots = {
  get: (deviceId, variable, range = '24h', aggregation = 'avg', bucket = '15 minutes', orgId) =>
    request(`/dots/${deviceId}/${variable}?range=${range}&aggregation=${aggregation}&bucket=${bucket}${orgId ? `&orgId=${orgId}` : ''}`),
  
  getRaw: (deviceId, variable, page = 1, limit = 10, orgId) =>
    request(`/dots/${deviceId}/${variable}/raw?page=${page}&limit=${limit}${orgId ? `&orgId=${orgId}` : ''}`),

  getMultiple: (deviceId, variables, range = '24h', orgId) =>
    request(`/dots/${deviceId}?variables=${variables.join(',')}&range=${range}${orgId ? `&orgId=${orgId}` : ''}`)
}

export const alerts = {
  list: (deviceId) => request(`/alerts/${deviceId}`),
  logs: (deviceId) => request(`/alerts/${deviceId}/logs`),
  create: (data) => request('/alerts', { method: 'POST', body: JSON.stringify(data) }),
  toggle: (id, active) => request(`/alerts/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  delete: (id) => request(`/alerts/${id}`, { method: 'DELETE' })
}

export const organizations = {
  list: () => request('/organizations'),
  get: (id) => request(`/organizations/${id}`),
  create: (data) => request('/organizations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateStatus: (id, status) => request(`/organizations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  setPaymentExempt: (id, exempt) => request(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify({ paymentExempt: exempt }) }),
  setBCategory: (id, bCategory) => request(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify({ bCategory }) }),
  revealCredentials: (id, adminPassword) => request(`/organizations/${id}/reveal-credentials`, { method: 'POST', body: JSON.stringify({ adminPassword }) }),
  resetPassword: (id) => request(`/organizations/${id}/reset-client-password`, { method: 'POST', body: JSON.stringify({}) })
}

export const spaces = {
  list: () => request('/spaces'),
  create: (data) => request('/spaces', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => request(`/spaces/${id}`),
  update: (id, data) => request(`/spaces/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  devices: (id) => request(`/spaces/${id}/devices`),
  config: (id) => request(`/spaces/${id}/aqi`),
  saveConfig: (id, data) => request(`/spaces/${id}/aqi`, { method: 'PUT', body: JSON.stringify(data) }),
  calculate: (id, values) => request(`/spaces/${id}/aqi/calculate`, { method: 'POST', body: JSON.stringify({ values }) }),
  delete: (id) => request(`/spaces/${id}`, { method: 'DELETE' })
}

export const reports = {
  getHeatmapData: (orgId, startDate, endDate) => request(`/reports/heatmap?orgId=${orgId || ''}&start=${startDate || ''}&end=${endDate || ''}`),
  getRespiratoryRisk: (orgId, startDate, endDate) => request(`/reports/respiratory-risk?orgId=${orgId || ''}&start=${startDate || ''}&end=${endDate || ''}`),
  getGlobalStats: () => request('/reports/stats'),

  // Public/Global reports (no orgId required/used)
  getGlobalHeatmap: (startDate, endDate) => request(`/public/reports/heatmap?start=${startDate || ''}&end=${endDate || ''}`),
  getGlobalRespiratoryRisk: (startDate, endDate) => request(`/public/reports/respiratory-risk?start=${startDate || ''}&end=${endDate || ''}`),
  getGlobalEnvironmentalReport: (startDate, endDate) => request(`/public/reports/environmental?start=${startDate || ''}&end=${endDate || ''}`),
  getGlobalPublicStats: () => request('/public/reports/stats')
}