import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const markerIcon = L.divIcon({
  className: 'map-marker-icon',
  html: '<span class="map-marker-dot"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
})

function Recenter({ center }) {
  const map = useMap()
  map.setView(center)
  return null
}

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng)
    }
  })
  return null
}

export default function MapPicker({ lat, lng, onChange, height = 220 }) {
  const center = [lat ?? 14.8347, lng ?? -91.5181]
  const hasCoords = lat != null && lng != null

  const handleGeoLocate = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    })
  }

  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between px-3 py-2 text-xs" style={{ background: 'var(--bg)', color: 'var(--text2)' }}>
        <span>{hasCoords ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : 'Seleccioná una ubicación'}</span>
        <button type="button" onClick={handleGeoLocate} className="text-xs" style={{ color: 'var(--green)' }}>
          Usar mi ubicación
        </button>
      </div>
      <MapContainer center={center} zoom={hasCoords ? 15 : 12} style={{ height }}>
        <Recenter center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={(pos) => onChange({ lat: pos.lat, lng: pos.lng })} />
        {hasCoords && (
          <Marker
            position={[lat, lng]}
            icon={markerIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const next = e.target.getLatLng()
                onChange({ lat: next.lat, lng: next.lng })
              }
            }}
          />
        )}
      </MapContainer>
    </div>
  )
}
