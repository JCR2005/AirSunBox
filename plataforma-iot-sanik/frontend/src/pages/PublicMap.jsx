import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import miniaturaImg from "../assets/miniatura.svg";
import { 
  Wind, MapPin, Droplets, Layers, ArrowLeft, Info, Leaf, Thermometer, Cloud, Map, X, ChevronRight
} from 'lucide-react';
import { devices as devicesApi } from '../services/api'; 
import logoImg from "../assets/logo2.svg"; 
import { useWebSocket } from '../hooks/useWebSocket';

import * as turf from '@turf/turf';
import XELA_ZONAS_GEOJSON from '../GeoJasons/zonas_quetzaltenango_quetzaltenango.json';


import logoNeo from '../Patrocinadores/logoNeo.jpeg';
import logoPhara from '../Patrocinadores/phara.jpeg';
import logoMontezco from '../Patrocinadores/MONTESCO.png';
import logoUsac from '../Patrocinadores/logousac.png';
const PATROCINADORES = [

  { nombre: 'Phara',                   src: logoPhara      },
  { nombre: 'moontezco',               src: logoMontezco   },
  { nombre: 'USAC',                    src: logoUsac       },
  { nombre: 'Neo',                     src: logoNeo        },
];


// ─── COLORES ─────────────────────────────────────────────────────────────────
const COLORS = {
  primary:    "#67B7E8",
  accent:     "#2BA8A0",
  bgDark:     "#0A0F18",
  bgLight:    "#F4F8FB",
  text:       "#1A253A", 
  textMuted:  "#6B7A91", 
  border:     "#DCE6EF",
  white:      "#ffffff",
  shadowLight: "0 8px 24px rgba(0,0,0,0.06)", 
};

// ─── HOOK: detectar móvil ────────────────────────────────────────────────────
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
};

// ─── COLORES AQI ─────────────────────────────────────────────────────────────
const getAqiColor = (category) => {
  if (!category) return '#9CA3AF';
  const cat = category.toLowerCase();
  if (cat.includes('excelente'))  return '#10B981';
  if (cat.includes('buena'))      return '#34D399';
  if (cat.includes('precaución')) return '#F59E0B';
  if (cat.includes('mala'))       return '#F97316';
  if (cat.includes('peligrosa'))  return '#EF4444';
  return '#9CA3AF';
};

// ─── CAPA DE ZONAS ────────────────────────────────────────────────────────────
const XelaZonasLayer = ({ zonaHover, onZonaHover, onZonaClick, selectedZona }) => {
  const getStyle = (feature) => {
    const isHovered = zonaHover === feature.properties.zona;
    return {
      fillColor:   '#9CA3AF',
      fillOpacity: isHovered ? 0.18 : 0.07,
      color:       isHovered ? '#5A7080' : '#9CA3AF',
      weight:      isHovered ? 2.5 : 1.5,
      opacity:     0.7,
    };
  };
  const onEachFeature = (feature, layer) => {
    layer.on({
      mouseover: (e) => {
        if (selectedZona && selectedZona !== feature.properties.zona) return;
        onZonaHover(feature.properties.zona);
        e.target.setStyle({ fillOpacity: 0.18, weight: 2.5, color: '#5A7080' });
      },
      mouseout: (e) => {
        onZonaHover(null);
        e.target.setStyle({ fillOpacity: 0.07, weight: 1.5, color: '#9CA3AF' });
      },
      click: () => onZonaClick(feature),
    });
    layer.bindTooltip(
      `<strong>${feature.properties.zona || 'Zona'}</strong>`,
      { sticky: false, direction: 'top', offset: [0, -8], className: 'xela-tooltip' }
    );
  };
  return (
    <GeoJSON
      key={`${JSON.stringify(XELA_ZONAS_GEOJSON)}-${selectedZona}`}
      data={XELA_ZONAS_GEOJSON}
      style={getStyle}
      onEachFeature={onEachFeature}
    />
  );
};

// ─── MARCADOR AQI ─────────────────────────────────────────────────────────────
const createAqiIcon = (category, status) => {
  const color = status === 'online' ? getAqiColor(category) : '#9CA3AF';
  return L.divIcon({
    className: 'custom-aqi-marker',
    html: `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
             <div style="width:16px;height:16px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 0 0 10px ${color}45,0 4px 8px rgba(0,0,0,.3);"></div>
           </div>`,
    iconSize: [44, 44], iconAnchor: [22, 22],
  });
};

// ─── AURA POR ESTACIÓN ────────────────────────────────────────────────────────
const AURA_RADIUS_METERS = 700;
const PerDeviceAuraLayer = ({ devices }) => {
  const map = useMap();
  useEffect(() => {
    if (!devices?.length) return;
    const layers = [];
    devices.filter(d => d.status === 'online' && d.lat && d.lng).forEach(device => {
      const color = getAqiColor(device.aqi_category);
      [
        { factor: 1.00, opacity: 0.08 }, { factor: 0.78, opacity: 0.15 },
        { factor: 0.56, opacity: 0.25 }, { factor: 0.36, opacity: 0.40 },
        { factor: 0.18, opacity: 0.65 },
      ].forEach(({ factor, opacity }) => {
        const c = L.circle([device.lat, device.lng], {
          radius: AURA_RADIUS_METERS * factor, color: 'transparent', weight: 0,
          fillColor: color, fillOpacity: opacity, interactive: false, bubblingMouseEvents: false,
        }).addTo(map);
        layers.push(c);
      });
    });
    return () => layers.forEach(l => map.removeLayer(l));
  }, [map, devices]);
  return null;
};

// ─── ICONO USUARIO ────────────────────────────────────────────────────────────
const createUserIcon = () => L.divIcon({
  className: '',
  html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 8px rgba(0,0,0,.25));">
           <div style="width:14px;height:14px;border-radius:50%;background:#2563EB;border:2px solid white;margin-bottom:-1px;"></div>
           <div style="width:20px;height:16px;border-radius:10px 10px 4px 4px;background:#2563EB;border:2px solid white;margin-bottom:-2px;"></div>
           <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #2563EB;"></div>
         </div>`,
  iconSize: [28, 42], iconAnchor: [14, 42],
});

// ─── UTILIDADES ───────────────────────────────────────────────────────────────
const getFeatureBounds = (feature) => {
  const latLngs = feature.geometry.coordinates[0].map(c => [c[1], c[0]]);
  return L.latLngBounds(latLngs);
};

const ResetZoomLayer = ({ trigger }) => {
  const map = useMap();
  useEffect(() => {
    if (!trigger) return;
    let bounds = null;
    XELA_ZONAS_GEOJSON.features.forEach(f => {
      const fb = getFeatureBounds(f);
      bounds = bounds ? bounds.extend(fb) : fb;
    });
    if (bounds) map.flyToBounds(bounds, { padding: [5,5], animate: true, duration: 1.0 });
  }, [map, trigger]);
  return null;
};

const AllZonesFitLayer = () => {
  const map = useMap();
  useEffect(() => {
    let bounds = null;
    XELA_ZONAS_GEOJSON.features.forEach(f => {
      const fb = getFeatureBounds(f);
      bounds = bounds ? bounds.extend(fb) : fb;
    });
    if (bounds) map.fitBounds(bounds, { padding: [10,10], animate: false });
  }, [map]);
  return null;
};

// ─── GEOLOCALIZACIÓN ──────────────────────────────────────────────────────────
const UserLocationLayer = ({ onLocationFound, onZonaDetected, onLocationDenied }) => {
  const map = useMap();
  useEffect(() => {
    if (!navigator.geolocation) { onLocationDenied(); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const pt = turf.point([lng, lat]);
        let zonaDelUsuario = null, zonaFeature = null;
        XELA_ZONAS_GEOJSON.features.forEach(f => {
          if (turf.booleanPointInPolygon(pt, f)) {
            zonaDelUsuario = f.properties.zona;
            zonaFeature = f;
          }
        });
        L.marker([lat, lng], { icon: createUserIcon(), zIndexOffset: 1000 })
          .bindTooltip(
            `<strong>📍 Estás aquí</strong>${zonaDelUsuario ? `<br><span style="color:#5A7080">${zonaDelUsuario}</span>` : ''}`,
            { permanent: false, sticky: false, className: 'xela-tooltip' }
          ).addTo(map);
        L.circle([lat, lng], { radius: pos.coords.accuracy, color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.08, weight: 1, opacity: 0.4 }).addTo(map);
        if (zonaFeature) {
          map.flyTo(getFeatureBounds(zonaFeature).getCenter(), 18, { animate: true, duration: 1.2 });
        } else {
          map.flyTo([lat, lng], 18, { animate: true, duration: 1.2 });
        }
        onLocationFound({ lat, lng });
        if (zonaDelUsuario) onZonaDetected(zonaDelUsuario);
      },
      (err) => { console.info('Geolocalización no disponible:', err.message); onLocationDenied(); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [map]);
  return null;
};

// ─── SPOTLIGHT Y ZOOM ─────────────────────────────────────────────────────────
const ZonaSpotlightLayer = ({ zonaFeature }) => {
  const map = useMap();
  const [pathD, setPathD] = useState('');
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!zonaFeature) { setPathD(''); return; }
    const update = () => {
      const { offsetWidth: w, offsetHeight: h } = map.getContainer();
      setSize({ w, h });
      const points = zonaFeature.geometry.coordinates[0].map(([lng, lat]) => {
        const px = map.latLngToContainerPoint([lat, lng]);
        return `${px.x},${px.y}`;
      });
      setPathD(`M0,0 L${w},0 L${w},${h} L0,${h} Z M${points.join(' L')} Z`);
    };
    update();
    map.on('move zoom viewreset resize', update);
    return () => map.off('move zoom viewreset resize', update);
  }, [map, zonaFeature]);
  if (!pathD || !zonaFeature) return null;
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: size.w, height: size.h, pointerEvents: 'none', zIndex: 450 }}>
      <path d={pathD} fillRule="evenodd" fill="rgba(233,235,238,0.6)" />
    </svg>
  );
};

const ZonaZoomLayer = ({ zonaFeature, isDeviceSelected }) => {
  const map = useMap();
  const prevDeviceSelected = useRef(false);

  useEffect(() => {
    if (!zonaFeature) return;
    
    // Zoom inicial al entrar a la zona
    if (!isDeviceSelected && !prevDeviceSelected.current) {
      map.flyTo(getFeatureBounds(zonaFeature).getCenter(), 15.9, { animate: true, duration: 1.0 });
    }
    
    // Zoom de regreso al salir de un dispositivo hacia la zona
    if (!isDeviceSelected && prevDeviceSelected.current) {
      map.flyTo(getFeatureBounds(zonaFeature).getCenter(), 15.9, { animate: true, duration: 1.0 });
    }

    prevDeviceSelected.current = isDeviceSelected;
  }, [map, zonaFeature, isDeviceSelected]);
  return null;
};

const DeviceZoomLayer = ({ device }) => {
  const map = useMap();
  useEffect(() => {
    if (!device || !device.lat || !device.lng) return;
    map.flyTo([device.lat, device.lng], 18, { animate: true, duration: 1.0 });
  }, [map, device]);
  return null;
};

// ─── REMOVE LEAFLET FOCUS BOX ─────────────────────────────────────────────────
const useRemoveLeafletFocusBox = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .leaflet-interactive:focus,.leaflet-interactive:focus-visible{outline:none!important;box-shadow:none!important;}
      .leaflet-overlay-pane path:focus,.leaflet-overlay-pane path:focus-visible{outline:none!important;}
      @keyframes spin{to{transform:rotate(360deg);}}
      @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
      @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.5;}}
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
};

// ─── MAP REF ──────────────────────────────────────────────────────────────────
const mapRef = { current: null };
const MapRefSetter = () => {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map]);
  return null;
};

// ─── BARRA DE BÚSQUEDA ────────────────────────────────────────────────────────
// ─── MARCADOR DE RESULTADO DE BÚSQUEDA ───────────────────────────────────────
const createSearchIcon = () => L.divIcon({
  className: '',
  html: `
    <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 12px rgba(37,99,235,0.4));">
      <div style="width:36px;height:36px;border-radius:50%;background:#2563EB;border:3px solid white;display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </div>
      <div style="width:2px;height:10px;background:#2563EB;margin-top:-2px;"></div>
    </div>
  `,
  iconSize: [36, 48], iconAnchor: [18, 48],
});

const SearchMarkerLayer = ({ marker, onClose }) => {
  const map = useMap();
  useEffect(() => {
    if (!marker) return;
    const icon = createSearchIcon();
    const m = L.marker([marker.lat, marker.lng], { icon, zIndexOffset: 2000 })
      .bindPopup(
        `<div style="font-family:system-ui;padding:4px 2px;">
           <p style="margin:0;font-size:0.8rem;font-weight:700;color:#1E293B;">${marker.name}</p>
           <p style="margin:4px 0 0;font-size:0.7rem;color:#64748B;">📍 Quetzaltenango</p>
         </div>`,
        { closeButton: true, className: 'search-popup' }
      )
      .addTo(map)
      .openPopup();
    return () => map.removeLayer(m);
  }, [map, marker]);
  return null;
};

// Bounding box de Quetzaltenango ciudad para forzar resultados locales
// viewbox: lon_min,lat_min,lon_max,lat_max
const XELA_BBOX = '-91.5800,14.7900,-91.4600,14.9100';

const PLACEHOLDERS = [
  'Buscar parque, calle, zona...',
  'Ej: Parque Central Xela',
  'Ej: Zoológico Minerva',
  'Ej: Mercado La Democracia',
  'Ej: Terminal de Buses',
  'Ej: Catedral de Quetzaltenango',
];

const SearchBar = ({ onResult, onClear, isMobile }) => {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [focused,  setFocused]  = useState(false);
  const [phIndex,  setPhIndex]  = useState(0);
  const [selected, setSelected] = useState(false); // true cuando ya eligió un resultado
  const debounceRef = useRef(null);
  const phRef       = useRef(null);

  // Rotar placeholders cada 3s cuando no está enfocado ni tiene texto
  useEffect(() => {
    if (focused || query) return;
    phRef.current = setInterval(() => setPhIndex(i => (i + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(phRef.current);
  }, [focused, query]);

  const search = async (text) => {
    if (!text || text.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      // viewbox restringe a Xela, bounded=1 fuerza resultados dentro del bbox
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=6&accept-language=es&viewbox=${XELA_BBOX}&bounded=1&countrycodes=gt`;
      let data = await (await fetch(url, { headers: { 'Accept-Language': 'es' } })).json();
      // Fallback: si no hay resultados locales, buscar sin bounded
      if (!data.length) {
        const url2 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text + ' Quetzaltenango')}&format=json&limit=4&accept-language=es&countrycodes=gt`;
        data = await (await fetch(url2, { headers: { 'Accept-Language': 'es' } })).json();
      }
      setResults(data);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(false);
    if (!val) setResults([]);
    clearTimeout(debounceRef.current);
    if (val) debounceRef.current = setTimeout(() => search(val), 350);
  };

  const handleSelect = (item) => {
    const name = item.display_name.split(',')[0];
    setQuery(name);
    setResults([]);
    setSelected(true);
    onResult(parseFloat(item.lat), parseFloat(item.lon), name);
  };

  // Tipo de lugar → icono emoji
  const placeIcon = (type) => {
    if (!type) return '📍';
    if (['park', 'garden', 'recreation_ground'].includes(type)) return '🌳';
    if (['marketplace', 'market', 'commercial'].includes(type)) return '🏪';
    if (['church', 'cathedral', 'place_of_worship'].includes(type)) return '⛪';
    if (['hospital', 'clinic', 'doctors'].includes(type)) return '🏥';
    if (['school', 'university', 'college'].includes(type)) return '🎓';
    if (['bus_station', 'terminal'].includes(type)) return '🚌';
    if (['restaurant', 'cafe', 'food_court'].includes(type)) return '🍽️';
    if (['hotel', 'hostel', 'guest_house'].includes(type)) return '🏨';
    if (['museum', 'theatre', 'cinema'].includes(type)) return '🎭';
    if (['road', 'residential', 'street'].includes(type)) return '🛣️';
    return '📍';
  };

  const containerStyle = isMobile
    ? { position: 'absolute', top: '12px', left: '12px', right: '12px', zIndex: 1000 }
    : { position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: '380px', maxWidth: 'calc(100vw - 220px)' };

  return (
    <div style={containerStyle}>
      {/* Input principal */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        backgroundColor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '16px', padding: '11px 16px',
        boxShadow: focused
          ? '0 8px 32px rgba(103,183,232,.3), 0 0 0 2px rgba(103,183,232,.25)'
          : '0 4px 20px rgba(0,0,0,.1)',
        border: `1px solid ${focused ? COLORS.primary : 'rgba(214,230,245,0.8)'}`,
        transition: 'all .25s cubic-bezier(.4,0,.2,1)',
      }}>
        {/* Icono izquierdo */}
        {loading
          ? <div style={{ width: 17, height: 17, borderRadius: '50%', border: `2.5px solid ${COLORS.border}`, borderTopColor: COLORS.primary, animation: 'spin .7s linear infinite', flexShrink: 0 }} />
          : <div style={{ width: 32, height: 32, borderRadius: '10px', backgroundColor: focused ? `${COLORS.primary}15` : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .2s' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={focused ? COLORS.primary : COLORS.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
        }
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Label flotante cuando está enfocado */}
          {(focused || query) && (
            <span style={{ fontSize: '0.6rem', fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1, marginBottom: '2px' }}>
              Buscar en Xela
            </span>
          )}
          <input
            type="text" value={query} onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => { setFocused(false); }, 150)}
            placeholder={PLACEHOLDERS[phIndex]}
            style={{
              border: 'none', outline: 'none',
              fontSize: focused || query ? '0.9rem' : '0.88rem',
              fontWeight: focused || query ? '600' : '400',
              color: COLORS.text, backgroundColor: 'transparent',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              transition: 'all .2s',
            }}
          />
        </div>
        {/* Badge estado */}
        {!query && !focused && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: `${COLORS.primary}12`, padding: '3px 8px', borderRadius: '99px', flexShrink: 0 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: COLORS.primary }}>📍 Xela</span>
          </div>
        )}
        {query && selected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#10B98115', padding: '3px 8px', borderRadius: '99px', flexShrink: 0 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#10B981' }}>✓ En mapa</span>
          </div>
        )}
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setSelected(false); onClear?.(); }}          style={{ background: `${COLORS.border}80`, border: 'none', cursor: 'pointer', color: COLORS.textMuted, padding: '4px', borderRadius: '50%', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* Resultados */}
      {results.length > 0 && (
        <div style={{
          marginTop: '8px', backgroundColor: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '16px', boxShadow: '0 12px 32px rgba(0,0,0,.1)',
          border: `1px solid ${COLORS.border}`, overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 14px 6px', borderBottom: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {results.length} resultado{results.length > 1 ? 's' : ''} en Quetzaltenango
            </span>
          </div>
          {results.map((item, i) => (
            <button
              key={item.place_id} onMouseDown={() => handleSelect(item)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left', backgroundColor: 'transparent', borderBottom: i < results.length - 1 ? `1px solid ${COLORS.border}` : 'none', transition: 'background .1s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F0F7FC'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {/* Icono según tipo */}
              <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: `${COLORS.primary}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1rem' }}>
                {placeIcon(item.type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '0.83rem', fontWeight: '600', color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.display_name.split(',')[0]}
                </p>
                <p style={{ margin: 0, fontSize: '0.7rem', color: COLORS.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.display_name.split(',').slice(1, 3).join(',')}
                </p>
              </div>
              <ChevronRight size={13} color={COLORS.textMuted} style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}

      {/* Sin resultados — solo si no acaba de seleccionar un lugar */}
      {results.length === 0 && query.length >= 2 && !loading && focused && !selected && (
        <div style={{ marginTop: '8px', backgroundColor: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,.08)', border: `1px solid ${COLORS.border}`, padding: '16px 14px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.82rem', color: COLORS.textMuted }}>😕 No encontramos <strong style={{ color: COLORS.text }}>{query}</strong> en Xela</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: COLORS.textMuted }}>Intentá con otro nombre o colonia</p>
        </div>
      )}
    </div>
  );
};

// ─── PANEL SELECTOR DE ZONAS ──────────────────────────────────────────────────
const ZonasPanel = ({ show, onClose, selectedZonaFeature, setSelectedZonaFeature, setResetTrigger, zoneAqiData, isMobile }) => {
  const panelStyle = isMobile
    ? { position: 'fixed', bottom: 0, left: 0, right: 0, height: show ? '60vh' : '0', zIndex: 2000, overflow: 'hidden', transition: 'height .35s cubic-bezier(.4,0,.2,1)', pointerEvents: show ? 'all' : 'none', borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,.15)' }
    : { position: 'absolute', top: 0, right: 0, bottom: 0, width: show ? '280px' : '0', zIndex: 1000, overflow: 'hidden', transition: 'width .3s cubic-bezier(.4,0,.2,1)', pointerEvents: show ? 'all' : 'none' };

  const innerStyle = isMobile
    ? { width: '100%', height: '60vh', backgroundColor: COLORS.white, display: 'flex', flexDirection: 'column', overflowY: 'auto', scrollbarWidth: 'none' }
    : { width: '280px', height: '100%', backgroundColor: COLORS.white, borderLeft: `1px solid ${COLORS.border}`, boxShadow: '-8px 0 32px rgba(0,0,0,.08)', display: 'flex', flexDirection: 'column', overflowY: 'auto', scrollbarWidth: 'none' };

  return (
    <div style={panelStyle}>
      <div style={innerStyle}>
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '99px', backgroundColor: COLORS.border }} />
          </div>
        )}
        <div style={{ padding: isMobile ? '8px 16px 12px' : '20px 16px 12px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, backgroundColor: COLORS.white, zIndex: 1 }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Selector de Zonas</p>
            <h3 style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 'bold', color: COLORS.text }}>Quetzaltenango</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.textMuted, padding: '4px', borderRadius: '8px' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '8px', flex: 1 }}>
          <button
            onClick={() => { setSelectedZonaFeature(null); setResetTrigger(t => t + 1); onClose(); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', marginBottom: '4px', backgroundColor: !selectedZonaFeature ? `${COLORS.primary}18` : 'transparent', border: !selectedZonaFeature ? `1px solid ${COLORS.primary}44` : '1px solid transparent', borderRadius: '10px', cursor: 'pointer', transition: 'all .15s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.primary, flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: COLORS.primary }}>Todas las zonas</span>
            </div>
            <ChevronRight size={14} color={COLORS.textMuted} />
          </button>
          {XELA_ZONAS_GEOJSON.features.map((feature) => {
            const zonaName   = feature.properties.zona;
            const isSelected = selectedZonaFeature?.properties?.zona === zonaName;
            const zonaDevs   = zoneAqiData[zonaName] || [];
            const onlineCnt  = zonaDevs.filter(d => d.status === 'online').length;
            let zonaColor    = '#9CA3AF';
            if (onlineCnt > 0) zonaColor = getAqiColor(zonaDevs.find(d => d.status === 'online')?.aqi_category);
            return (
              <button
                key={zonaName}
                onClick={() => { setSelectedZonaFeature(feature); onClose(); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', marginBottom: '4px', backgroundColor: isSelected ? `${zonaColor}18` : 'transparent', border: isSelected ? `1px solid ${zonaColor}55` : '1px solid transparent', borderRadius: '10px', cursor: 'pointer', transition: 'all .15s', textAlign: 'left' }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f5f7fa'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: zonaColor, flexShrink: 0, boxShadow: `0 0 0 3px ${zonaColor}30` }} />
                  <div>
                    <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: isSelected ? '700' : '500', color: COLORS.text }}>{zonaName}</p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: COLORS.textMuted }}>
                      {onlineCnt > 0 ? `${onlineCnt} estación${onlineCnt > 1 ? 'es' : ''} activa${onlineCnt > 1 ? 's' : ''}` : 'Sin estaciones activas'}
                    </p>
                  </div>
                </div>
                <ChevronRight size={14} color={isSelected ? zonaColor : COLORS.textMuted} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── SOL MASCOTA ANIMADO ──────────────────────────────────────────────────────
// El Sol cambia expresión, color y animación según la categoría AQI.
// Cada estado tiene su propia personalidad visual.
const SolMascota = ({ category, size = 90 }) => {
  const cat = (category || '').toLowerCase();

  // Configuración por estado
  const config = {
    excelente: {
      bodyColor:  '#67B7E8',
      innerColor: '#3A9BD5',
      rayColor:   '#67B7E8',
      eyeColor:   '#185F8A',
      animation:  'solFloat 2.5s ease-in-out infinite',
      // Cara feliz — ojos abiertos, sonrisa grande
      leftEye:  { rx: 9, ry: 10, lidPath: null },
      rightEye: { rx: 9, ry: 10, lidPath: null },
      mouth: 'M-14 8 Q0 22 14 8',
      hasMask: false,
      hasStar: true,
    },
    buena: {
      bodyColor:  '#67B7E8',
      innerColor: '#3A9BD5',
      rayColor:   '#67B7E8',
      eyeColor:   '#185F8A',
      animation:  'solFloat 3s ease-in-out infinite',
      leftEye:  { rx: 9, ry: 9, lidPath: null },
      rightEye: { rx: 9, ry: 9, lidPath: null },
      mouth: 'M-12 6 Q0 17 12 6',
      hasMask: false,
      hasStar: false,
    },
    'precaución': {
      bodyColor:  '#F59E0B',
      innerColor: '#D97706',
      rayColor:   '#F59E0B',
      eyeColor:   '#92400E',
      animation:  'solPulse 2s ease-in-out infinite',
      leftEye:  { rx: 9, ry: 7, lidPath: 'M-9 -3 Q0 -8 9 -3' },
      rightEye: { rx: 9, ry: 7, lidPath: 'M-9 -3 Q0 -8 9 -3' },
      mouth: 'M-10 8 Q0 12 10 8',
      hasMask: false,
      hasStar: false,
    },
    mala: {
      bodyColor:  '#F97316',
      innerColor: '#EA580C',
      rayColor:   '#F97316',
      eyeColor:   '#7C2D12',
      animation:  'solShake 1.5s ease-in-out infinite',
      leftEye:  { rx: 9, ry: 7, lidPath: 'M-9 -2 Q0 -7 9 -2' },
      rightEye: { rx: 9, ry: 7, lidPath: 'M-9 -2 Q0 -7 9 -2' },
      mouth: 'M-10 10 Q0 6 10 10',
      hasMask: true,
      hasStar: false,
    },
    peligrosa: {
      bodyColor:  '#EF4444',
      innerColor: '#DC2626',
      rayColor:   '#EF4444',
      eyeColor:   '#7F1D1D',
      animation:  'solShake 0.8s ease-in-out infinite',
      leftEye:  { rx: 9, ry: 6, lidPath: 'M-9 0 Q0 -7 9 0' },
      rightEye: { rx: 9, ry: 6, lidPath: 'M-9 0 Q0 -7 9 0' },
      mouth: 'M-11 11 Q0 5 11 11',
      hasMask: true,
      hasStar: false,
    },
  };

  const c = config[cat] || config['buena'];
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r  = s * 0.34;
  const ri = s * 0.27;
  const rayLen = s * 0.13;
  const rayW   = s * 0.055;

  // Posiciones de los 8 rayos
  const rayAngles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <div style={{ position: 'relative', width: s, height: s, flexShrink: 0 }}>
      <style>{`
        @keyframes solFloat  { 0%,100%{transform:translateY(0)}    50%{transform:translateY(-6px)} }
        @keyframes solPulse  { 0%,100%{transform:scale(1)}         50%{transform:scale(1.05)} }
        @keyframes solShake  { 0%,100%{transform:translateX(0)}    25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
        @keyframes maskBob   { 0%,100%{transform:translateY(0)}    50%{transform:translateY(2px)} }
        @keyframes blink     { 0%,90%,100%{transform:scaleY(1)}    95%{transform:scaleY(0.1)} }
        @keyframes starSpin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      <svg
        width={s} height={s} viewBox={`0 0 ${s} ${s}`}
        style={{ animation: c.animation, transformOrigin: 'center' }}
      >
        {/* Rayos */}
        {rayAngles.map((angle, i) => {
          const rad  = (angle * Math.PI) / 180;
          const x1   = cx + (r + 2) * Math.cos(rad);
          const y1   = cy + (r + 2) * Math.sin(rad);
          const x2   = cx + (r + rayLen) * Math.cos(rad);
          const y2   = cy + (r + rayLen) * Math.sin(rad);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={c.rayColor} strokeWidth={rayW} strokeLinecap="round"
              opacity={i % 2 === 0 ? 1 : 0.6}
            />
          );
        })}

        {/* Cuerpo exterior */}
        <circle cx={cx} cy={cy} r={r} fill={c.bodyColor} stroke="#0A0F18" strokeWidth={s*0.025}/>
        {/* Cuerpo interior */}
        <circle cx={cx} cy={cy + s*0.015} r={ri} fill={c.innerColor}/>
        {/* Brillo */}
        <ellipse cx={cx - r*0.3} cy={cy - r*0.3} rx={r*0.28} ry={r*0.18} fill="white" opacity="0.28"/>

      {/* Ojo izquierdo */}
        {/* El <g> externo se encarga EXCLUSIVAMENTE de la posición */}
        <g transform={`translate(${cx - r*0.38} ${cy - r*0.05})`}>
          {/* El <g> interno se encarga EXCLUSIVAMENTE de la animación */}
          <g style={{ animation: 'blink 4s ease-in-out infinite' }}>
            <ellipse rx={c.leftEye.rx * s/90} ry={c.leftEye.ry * s/90} fill="white" stroke="#0A0F18" strokeWidth={s*0.022}/>
            {c.leftEye.lidPath && (
              <path d={c.leftEye.lidPath.replace(/(-?\d+\.?\d*)/g, n => n * s/90)} fill="#0A0F18"/>
            )}
            <circle cx={0} cy={0} r={s*0.055} fill={c.eyeColor}/>
            <circle cx={0} cy={0} r={s*0.028} fill="#0A0F18"/>
            <circle cx={-s*0.015} cy={-s*0.015} r={s*0.014} fill="white"/>
          </g>
        </g>

        {/* Ojo derecho */}
        <g transform={`translate(${cx + r*0.38} ${cy - r*0.05})`}>
          <g style={{ animation: 'blink 4s ease-in-out infinite 0.3s' }}>
            <ellipse rx={c.rightEye.rx * s/90} ry={c.rightEye.ry * s/90} fill="white" stroke="#0A0F18" strokeWidth={s*0.022}/>
            {c.rightEye.lidPath && (
              <path d={c.rightEye.lidPath.replace(/(-?\d+\.?\d*)/g, n => n * s/90)} fill="#0A0F18"/>
            )}
            <circle cx={0} cy={0} r={s*0.055} fill={c.eyeColor}/>
            <circle cx={0} cy={0} r={s*0.028} fill="#0A0F18"/>
            <circle cx={-s*0.015} cy={-s*0.015} r={s*0.014} fill="white"/>
          </g>
        </g>
        {/* Nariz */}
        <ellipse cx={cx} cy={cy + r*0.28} rx={s*0.055} ry={s*0.042}
          fill={c.innerColor} stroke="#0A0F18" strokeWidth={s*0.018}/>

        {/* Boca — sin mascarilla */}
        {!c.hasMask && (
          <path
            d={c.mouth.replace(/(-?\d+\.?\d*)/g, n => n * s/90)}
            transform={`translate(${cx} ${cy + r*0.42})`}
            fill="none" stroke="#0A0F18" strokeWidth={s*0.04} strokeLinecap="round"
          />
        )}

        {/* Mascarilla — estados mala/peligrosa */}
        {c.hasMask && (
          <g style={{ animation: 'maskBob 2s ease-in-out infinite' }}>
            {/* Forma mascarilla */}
            <rect x={cx - r*0.7} y={cy + r*0.15} width={r*1.4} height={r*0.68}
              rx={r*0.18} fill="white" stroke="#0A0F18" strokeWidth={s*0.025}/>
            {/* Líneas mascarilla */}
            <line x1={cx - r*0.5} y1={cy + r*0.42} x2={cx + r*0.5} y2={cy + r*0.42}
              stroke="#D1D5DB" strokeWidth={s*0.02}/>
            <line x1={cx - r*0.5} y1={cy + r*0.6}  x2={cx + r*0.5} y2={cy + r*0.6}
              stroke="#D1D5DB" strokeWidth={s*0.02}/>
            {/* Elásticos */}
            <path d={`M${cx - r*0.68} ${cy + r*0.28} C${cx - r*1.0} ${cy + r*0.1} ${cx - r*0.9} ${cy - r*0.2} ${cx - r*0.6} ${cy - r*0.25}`}
              fill="none" stroke="#9CA3AF" strokeWidth={s*0.02} strokeLinecap="round"/>
            <path d={`M${cx + r*0.68} ${cy + r*0.28} C${cx + r*1.0} ${cy + r*0.1} ${cx + r*0.9} ${cy - r*0.2} ${cx + r*0.6} ${cy - r*0.25}`}
              fill="none" stroke="#9CA3AF" strokeWidth={s*0.02} strokeLinecap="round"/>
          </g>
        )}

        {/* Estrellita — solo estado excelente */}
        {c.hasStar && (
          <g transform={`translate(${cx + r*0.78} ${cy - r*0.82})`}
             style={{ animation: 'starSpin 3s linear infinite', transformOrigin: '0 0' }}>
            <polygon points="0,-8 2,-3 7,-3 3,1 5,6 0,3 -5,6 -3,1 -7,-3 -2,-3"
              fill="#2BA8A0" stroke="#0A0F18" strokeWidth="1.2"
              transform={`scale(${s/90})`}/>
          </g>
        )}
      </svg>
    </div>
  );
};


const RECOMENDACIONES = {
  'Excelente':  { emoji: '🌿', texto: 'Aire en condiciones ideales. Perfecta para actividades al aire libre sin restricciones.' },
  'Buena':      { emoji: '😊', texto: 'Calidad aceptable. La mayoría de personas pueden hacer actividades normales sin riesgo.' },
  'Precaución': { emoji: '⚠️', texto: 'Grupos sensibles como niños, adultos mayores o personas con asma deben limitar el esfuerzo prolongado al aire libre.' },
  'Mala':       { emoji: '😷', texto: 'Todos pueden empezar a sentir efectos. Reducir actividades intensas en exteriores y considerar usar mascarilla.' },
  'Peligrosa':  { emoji: '🚨', texto: 'Riesgo alto para toda la población. Se recomienda permanecer en interiores y evitar salir sin protección.' },
};

// ─── PANEL DE ZONA SELECCIONADA (REDISEÑADO) ──────────────────────────────────
const ZonaPanel = ({ zonaFeature, zonaAqiResult, loadingZona, onClose, onSelectDevice, devices, isMobile }) => {
  if (!zonaFeature) return null;

  const zonaName    = zonaFeature.properties.zona;
  const aqiColor    = getAqiColor(zonaAqiResult?.category);
  const aqiPromedio = zonaAqiResult?.aqi_promedio;
  const category    = zonaAqiResult?.category ?? '...';
  const onlineCnt   = zonaAqiResult?.online_count ?? 0;
  const totalCnt    = zonaAqiResult?.total_count  ?? 0;
  const clima       = zonaAqiResult?.clima ?? {};
  const recomend    = RECOMENDACIONES[category];

  // Dispositivos de esta zona
  const zonaDevices = devices.filter(d => {
    if (!d.lat || !d.lng) return false;
    return turf.booleanPointInPolygon(turf.point([d.lng, d.lat]), zonaFeature);
  });

  const panelStyle = isMobile
    ? {
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2001,
        backgroundColor: COLORS.bgLight, borderRadius: '24px 24px 0 0',
        boxShadow: '0 -12px 32px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto',
        animation: 'fadeIn .3s ease', scrollbarWidth: 'none',
      }
    : {
        position: 'fixed', top: '8%', right: '24px', zIndex: 2000,
        width: '30%', maxHeight: '85%', overflowY: 'auto',
        backgroundColor: COLORS.bgLight, borderRadius: '24px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.12)', border: `1px solid ${COLORS.border}`,
        animation: 'fadeIn .3s ease',
        scrollbarWidth: 'none',
      };

  // Stat chip (Temp, Hum, CO2, CO)
  const StatRow = ({ icon: Icon, label, value, unit, color }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Icon size={15} color={loadingZona ? COLORS.border : color} />
        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: loadingZona ? COLORS.border : COLORS.text, display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        {loadingZona ? '—' : (value !== null && value !== undefined ? value : '—')}
        {!loadingZona && value !== null && value !== undefined && (
          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: color }}>{unit}</span>
        )}
      </div>
    </div>
  );

  return (
    <div style={panelStyle}>
      {isMobile && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0', backgroundColor: COLORS.bgLight }}>
          <div style={{ width: '40px', height: '5px', borderRadius: '99px', backgroundColor: COLORS.border }} />
        </div>
      )}

      {/* CABECERA */}
      <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Zona Seleccionada
          </p>
          <h3 style={{ margin: '4px 0 2px', fontSize: '1.4rem', fontWeight: '900', color: COLORS.text }}>{zonaName}</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: COLORS.textMuted, fontWeight: '500' }}>
            {totalCnt > 0
              ? `${onlineCnt} de ${totalCnt} estaciones activas`
              : 'Sin estaciones activas'}
          </p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.textMuted }}>
          <X size={22} />
        </button>
      </div>

      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* MAPA MINIATURA */}
        <div style={{ borderRadius: '16px', overflow: 'hidden', height: '140px', border: `1px solid ${COLORS.border}`, position: 'relative' }}>
          <MapContainer
            key={zonaName}
            center={getFeatureBounds(zonaFeature).getCenter()}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} keyboard={false} attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <GeoJSON data={{ type: 'FeatureCollection', features: [zonaFeature] }} style={{ fillColor: aqiColor, fillOpacity: 0.3, color: aqiColor, weight: 3, opacity: 0.9 }} />
          </MapContainer>
          <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '20px', padding: '4px 14px', zIndex: 1000, fontSize: '0.8rem', fontWeight: '700', color: COLORS.text, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            📍 {zonaName}
          </div>
        </div>

        {/* TARJETA CALIDAD DEL AIRE + DATOS */}
        <div style={{ backgroundColor: COLORS.white, borderRadius: '20px', border: `1px solid ${COLORS.border}`, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: COLORS.shadowLight }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '20px', alignItems: 'center' }}>
            {/* Medidor AQI */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Calidad del Aire</span>
                <Info size={12} color={COLORS.primary} />
              </div>
              
              {/* Barra escala horizontal */}
              <div style={{ width: '100%', position: 'relative' }}>
                <div style={{ display: 'flex', width: '100%', height: '6px', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ flex: 1, backgroundColor: '#10B981' }} /><div style={{ flex: 1, backgroundColor: '#34D399' }} />
                  <div style={{ flex: 1, backgroundColor: '#F59E0B' }} /><div style={{ flex: 1, backgroundColor: '#F97316' }} />
                  <div style={{ flex: 1, backgroundColor: '#EF4444' }} />
                </div>
                {!loadingZona && aqiPromedio !== null && aqiPromedio !== undefined && (
                  <div style={{ position: 'absolute', top: '-2px', left: `calc(${Math.min(100, Math.max(0, aqiPromedio))}% - 5px)`, width: '10px', height: '10px', backgroundColor: 'white', border: '2px solid #9CA3AF', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                )}
              </div>

              {/* Burbuja grande */}
              <div style={{
                width: '100px', height: '100px', borderRadius: '50%', backgroundColor: loadingZona ? COLORS.border : aqiColor,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: 'white', boxShadow: loadingZona ? 'none' : `0 12px 28px ${aqiColor}60`, transition: 'all .4s'
              }}>
                <Leaf size={20} style={{ marginBottom: '2px' }} />
                <span style={{ fontSize: '2.2rem', fontWeight: '900', lineHeight: 1 }}>
                  {loadingZona ? '·' : (aqiPromedio !== null && aqiPromedio !== undefined ? aqiPromedio : '--')}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', marginTop: '2px' }}>
                  {loadingZona ? '...' : category}
                </span>
              </div>
            </div>

            {/* Stats Clima/Gases */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <StatRow icon={Thermometer} label="Temp." value={clima.temp_promedio} unit="°C" color="#EF4444" />
              <div style={{ height: '1px', backgroundColor: COLORS.border, margin: '2px 0' }} />
              <StatRow icon={Droplets} label="Hum." value={clima.hum_promedio} unit="%" color="#3B82F6" />
              <div style={{ height: '1px', backgroundColor: COLORS.border, margin: '2px 0' }} />
              <StatRow icon={Cloud} label="CO₂" value={clima.co2_promedio} unit="ppm" color="#8B5CF6" />
              <div style={{ height: '1px', backgroundColor: COLORS.border, margin: '2px 0' }} />
              <StatRow icon={Wind} label="CO" value={clima.co_promedio} unit="ppm" color="#F97316" />
            </div>
          </div>
        </div>

        {/* TARJETA ESTACIONES */}
        {totalCnt > 0 && (
          <div style={{ backgroundColor: COLORS.white, borderRadius: '20px', border: `1px solid ${COLORS.border}`, padding: '20px', boxShadow: COLORS.shadowLight }}>
            <p style={{ margin: '0 0 16px', fontSize: '0.75rem', fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Estaciones
            </p>
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'thin' }}>
              {zonaDevices.map(d => {
                const zonaDevice = zonaAqiResult?.devices?.find(zd => zd.id === d.id);
                const devAqi     = loadingZona ? null : (zonaDevice?.aqi ?? null);
                const devCat     = loadingZona ? null : (zonaDevice?.category ?? null);
                const isOnline   = (zonaDevice?.hasData === true) || (d.status === 'online');
                const devColor   = isOnline ? getAqiColor(devCat) : '#9CA3AF';
                return (
                  <button
                    key={d.id} onClick={() => onSelectDevice(d)} title={d.name}
                    style={{
                      flex: '0 0 100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      padding: '5px 8px', borderRadius: '16px', cursor: 'pointer', backgroundColor: COLORS.bgLight, border: `1.5px solid ${COLORS.border}`, transition: 'all .15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E4F1FB'; e.currentTarget.style.borderColor = devColor; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = COLORS.bgLight; e.currentTarget.style.borderColor = COLORS.border; }}
                  >
                    <div style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '12px', backgroundColor: `${devColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Wind size={20} color={devColor} />
                      <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: isOnline ? devColor : '#9CA3AF', border: '2px solid white' }} />
                    </div>
                    {isOnline && !loadingZona && devAqi !== null && (
                      <span style={{ fontSize: '1rem', fontWeight: '900', color: devColor, lineHeight: 1 }}>{devAqi}</span>
                    )}
                    <span style={{ fontSize: '0.7rem', color: COLORS.textMuted, textAlign: 'center', lineHeight: 1.2, fontWeight: '600', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TARJETA RECOMENDACIONES CON SOL MASCOTA */}
        <div style={{ backgroundColor: COLORS.white, borderRadius: '20px', border: `1px solid ${COLORS.border}`, padding: '20px', boxShadow: COLORS.shadowLight }}>
          <p style={{ margin: '0 0 14px', fontSize: '0.75rem', fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Recomendaciones
          </p>
          {loadingZona || !recomend ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: 70, height: 70, borderRadius: '50%', backgroundColor: COLORS.bgLight, flexShrink: 0 }}/>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ height: '12px', backgroundColor: COLORS.bgLight, borderRadius: '6px' }}/>
                <div style={{ height: '12px', backgroundColor: COLORS.bgLight, borderRadius: '6px', width: '75%' }}/>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <SolMascota category={category} size={80} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 6px', fontSize: '0.78rem', fontWeight: '800', color: getAqiColor(category), textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Aire {category}
                </p>
                <p style={{ margin: 0, fontSize: '0.83rem', color: COLORS.text, lineHeight: 1.55, fontWeight: '500' }}>
                  {recomend.texto}
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

// ─── PANEL DE DISPOSITIVO ─────────────────────────────────────────────────────
const DevicePanel = ({ selectedDevice, onBack, isMobile, currentAqiColor, temp, hum, co2, co }) => {
  if (!selectedDevice) return null;

  const isOnline = selectedDevice.status === 'online';
  const aqiNumber = Number(selectedDevice.aqi_value);
  const hasAqi = isOnline && Number.isFinite(aqiNumber);
  const category = isOnline ? (selectedDevice.aqi_category || 'Calculando') : 'Sin datos';
  const aqiValue = hasAqi ? Math.round(aqiNumber) : null;
  const recomend = RECOMENDACIONES[category];

  const fmt = (value, decimals) => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(decimals) : null;
  };

  const panelStyle = isMobile
    ? {
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2002,
        backgroundColor: COLORS.bgLight, borderRadius: '24px 24px 0 0',
        boxShadow: '0 -12px 32px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto',
        animation: 'fadeIn .3s ease', scrollbarWidth: 'none',
      }
    : {
        position: 'fixed', top: '8%', right: '24px', zIndex: 2002,
        width: '30%', maxHeight: '85%', overflowY: 'auto',
        backgroundColor: COLORS.bgLight, borderRadius: '24px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.12)', border: `1px solid ${COLORS.border}`,
        animation: 'fadeIn .3s ease',
        scrollbarWidth: 'none',
      };

  const StatRow = ({ icon: Icon, label, value, unit, color }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Icon size={15} color={color} />
        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: COLORS.text, display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        {value !== null && value !== undefined ? value : '—'}
        {value !== null && value !== undefined && (
          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: color }}>{unit}</span>
        )}
      </div>
    </div>
  );

  return (
    <div style={panelStyle}>
      {isMobile && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0', backgroundColor: COLORS.bgLight }}>
          <div style={{ width: '40px', height: '5px', borderRadius: '99px', backgroundColor: COLORS.border }} />
        </div>
      )}

      {/* CABECERA */}
      <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Estación de Monitoreo
          </p>
          <h3 style={{ margin: '4px 0 2px', fontSize: '1.4rem', fontWeight: '900', color: COLORS.text }}>{selectedDevice.name}</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: COLORS.textMuted, fontWeight: '500' }}>
            {selectedDevice.status === 'online' ? '🟢 Conectada ahora' : '🔴 Inactiva'}
          </p>
        </div>
        {onBack && (
          <button onClick={onBack} title="Volver a la zona" style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.textMuted }}>
            <X size={22} />
          </button>
        )}
      </div>

      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* MAPA MINIATURA + FOTO INSTALACIÓN */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', height: '140px' }}>
          {/* Mapa */}
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${COLORS.border}`, position: 'relative' }}>
            <MapContainer
              key={selectedDevice.id}
              center={[selectedDevice.lat, selectedDevice.lng]}
              zoom={16}
              style={{ width: '100%', height: '100%' }}
              zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} keyboard={false} attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[selectedDevice.lat, selectedDevice.lng]} icon={createAqiIcon(selectedDevice.aqi_category, selectedDevice.status)} />
            </MapContainer>
            <div style={{ position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '20px', padding: '2px 10px', zIndex: 1000, fontSize: '0.65rem', fontWeight: '700', color: COLORS.text, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', whiteSpace: 'nowrap' }}>
              📍 Ubicación
            </div>
          </div>

          {/* Foto (Placeholder) */}
          <div style={{ 
            borderRadius: '16px', overflow: 'hidden', border: `1px solid ${COLORS.border}`, 
            position: 'relative', backgroundColor: '#E2E8F0',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            backgroundImage: `linear-gradient(45deg, ${COLORS.bgLight} 25%, transparent 25%, transparent 50%, ${COLORS.bgLight} 50%, ${COLORS.bgLight} 75%, transparent 75%, transparent)`,
            backgroundSize: '20px 20px'
          }}>
            <div style={{ 
              width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'white', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted,
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '4px'
            }}>
              <MapPin size={20} />
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Instalación</span>
            
            {/* Overlay sutil para cuando haya foto real */}
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.02)' }} />
          </div>
        </div>

        {/* TARJETA CALIDAD DEL AIRE + DATOS */}
        <div style={{ backgroundColor: COLORS.white, borderRadius: '20px', border: `1px solid ${COLORS.border}`, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: COLORS.shadowLight }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '20px', alignItems: 'center' }}>
            {/* Medidor AQI */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Calidad del Aire</span>
                <Info size={12} color={COLORS.primary} />
              </div>
              
              {/* Barra escala horizontal */}
              <div style={{ width: '100%', position: 'relative' }}>
                <div style={{ display: 'flex', width: '100%', height: '6px', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ flex: 1, backgroundColor: '#10B981' }} /><div style={{ flex: 1, backgroundColor: '#34D399' }} />
                  <div style={{ flex: 1, backgroundColor: '#F59E0B' }} /><div style={{ flex: 1, backgroundColor: '#F97316' }} />
                  <div style={{ flex: 1, backgroundColor: '#EF4444' }} />
                </div>
                {aqiValue !== null && (
                  <div style={{ position: 'absolute', top: '-2px', left: `calc(${Math.min(100, Math.max(0, aqiValue))}% - 5px)`, width: '10px', height: '10px', backgroundColor: 'white', border: '2px solid #9CA3AF', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                )}
              </div>

              {/* Burbuja grande */}
              <div style={{
                width: '100px', height: '100px', borderRadius: '50%', backgroundColor: currentAqiColor,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: 'white', boxShadow: `0 12px 28px ${currentAqiColor}60`, transition: 'all .4s'
              }}>
                <Leaf size={20} style={{ marginBottom: '2px' }} />
                <span style={{ fontSize: '2.2rem', fontWeight: '900', lineHeight: 1 }}>
                  {aqiValue !== null ? aqiValue : '--'}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', marginTop: '2px' }}>
                  {category}
                </span>
              </div>
            </div>

            {/* Stats Clima/Gases */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <StatRow icon={Thermometer} label="Temp." value={fmt(temp, 1)} unit="°C" color="#EF4444" />
              <div style={{ height: '1px', backgroundColor: COLORS.border, margin: '2px 0' }} />
              <StatRow icon={Droplets} label="Hum." value={fmt(hum, 1)} unit="%" color="#3B82F6" />
              <div style={{ height: '1px', backgroundColor: COLORS.border, margin: '2px 0' }} />
              <StatRow icon={Cloud} label="CO₂" value={fmt(co2, 0)} unit="ppm" color="#8B5CF6" />
              <div style={{ height: '1px', backgroundColor: COLORS.border, margin: '2px 0' }} />
              <StatRow icon={Wind} label="CO" value={fmt(co, 1)} unit="ppm" color="#F97316" />
            </div>
          </div>
        </div>

        {/* TARJETA RECOMENDACIONES CON SOL MASCOTA */}
        <div style={{ backgroundColor: COLORS.white, borderRadius: '20px', border: `1px solid ${COLORS.border}`, padding: '20px', boxShadow: COLORS.shadowLight }}>
          <p style={{ margin: '0 0 14px', fontSize: '0.75rem', fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Recomendaciones
          </p>
          {!recomend ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: 70, height: 70, borderRadius: '50%', backgroundColor: COLORS.bgLight, flexShrink: 0 }}/>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ height: '12px', backgroundColor: COLORS.bgLight, borderRadius: '6px' }}/>
                <div style={{ height: '12px', backgroundColor: COLORS.bgLight, borderRadius: '6px', width: '75%' }}/>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <SolMascota category={category} size={80} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 6px', fontSize: '0.78rem', fontWeight: '800', color: getAqiColor(category), textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Aire {category}
                </p>
                <p style={{ margin: 0, fontSize: '0.83rem', color: COLORS.text, lineHeight: 1.55, fontWeight: '500' }}>
                  {recomend.texto}
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function PublicMap() {
  useRemoveLeafletFocusBox();
  const isMobile = useIsMobile();

  const [devices,           setDevices]           = useState([]);
  const [selectedDevice,    setSelectedDevice]    = useState(null);
  const [showHeatmap,       setShowHeatmap]       = useState(true);
  const [loading,           setLoading]           = useState(true);
  const [userLocation,      setUserLocation]      = useState(null);
  const [userZona,          setUserZona]          = useState(null);
  const [locationDenied,    setLocationDenied]    = useState(false);
  const [selectedZonaFeature, setSelectedZonaFeature] = useState(null);
  const [resetTrigger,      setResetTrigger]      = useState(0);
  const [showZonesPanel,    setShowZonesPanel]    = useState(false);
  const [zonaHover,         setZonaHover]         = useState(null);
  const [zoneAqiData,       setZoneAqiData]       = useState({});
  const [zonaAqiResult,     setZonaAqiResult]     = useState(null);
  const [searchMarker,      setSearchMarker]      = useState(null);
  const [loadingZona,       setLoadingZona]       = useState(false);   

  // ── Tiempo real: suscribirse a los dispositivos visibles (con GPS) ──
  const visibleIds = useMemo(
    () => devices.filter(d => d.lat && d.lng).map(d => d.id).join(','),
    [devices]
  );
  const visibleIdList = useMemo(() => visibleIds ? visibleIds.split(',') : [], [visibleIds]);
  const { lastValues, connected } = useWebSocket(visibleIdList);

  // Al recibir datos nuevos por WebSocket, refrescar el AQI de los
  // dispositivos afectados y el promedio de la zona activa (con debounce).
  // No se toca selectedDevice ni selectedZonaFeature, así el usuario no pierde
  // la estación / vista que está observando.
  const selZonaRef = useRef(selectedZonaFeature);
  useEffect(() => { selZonaRef.current = selectedZonaFeature; }, [selectedZonaFeature]);
  const zonaAqiDataRef = useRef(zoneAqiData);
  useEffect(() => { zonaAqiDataRef.current = zoneAqiData; }, [zoneAqiData]);
  const devicesRef = useRef(devices);
  useEffect(() => { devicesRef.current = devices; }, [devices]);

  const wsDebounceRef = useRef(null);
  useEffect(() => {
    const affectedIds = Object.keys(lastValues);
    if (!affectedIds.length) return;
    clearTimeout(wsDebounceRef.current);
    wsDebounceRef.current = setTimeout(async () => {
      try {
        const updates = await Promise.all(
          affectedIds.map(async (id) => {
            try {
              const aqiData = await devicesApi.aqiPublic(id);
              const my = lastValues[id] || {};
              const liveVars = aqiData.variables || {};
              Object.entries(my).forEach(([v, val]) => {
                liveVars[v] = { value: val.value, time: val.time, ...(liveVars[v] || {}) };
              });
              return { id, aqi_value: aqiData.aqi ?? null, aqi_category: aqiData.category ?? null, liveVariables: liveVars };
            } catch { return null; }
          })
        );

        const patch = {};
        updates.forEach(u => { if (u) patch[u.id] = u; });

        const nextDevices = devicesRef.current.map(d => {
          const u = patch[d.id];
          return u ? { ...d, ...u } : d;
        });
        setDevices(nextDevices);

        // Actualizar el color/estado de la zona en el mapa con los datos
        // nuevos de los dispositivos afectados (sin recrear la vista).
        try {
          const zonePatch = {};
          nextDevices.forEach(d => {
            if (!(d.lat && d.lng)) return;
            const pt = turf.point([d.lng, d.lat]);
            XELA_ZONAS_GEOJSON.features.forEach(feature => {
              if (turf.booleanPointInPolygon(pt, feature)) {
                const zonaName = feature.properties.zona;
                if (!zonePatch[zonaName]) zonePatch[zonaName] = [];
                zonePatch[zonaName].push({ id: d.id, status: d.status, aqi_category: d.aqi_category, aqi_value: d.aqi_value });
              }
            });
          });
          setZoneAqiData(prev => {
            const next = { ...prev };
            Object.entries(zonePatch).forEach(([zonaName, devs]) => {
              const byId = {};
              devs.forEach(d => byId[d.id] = d);
              const existing = (next[zonaName] || []).filter(d => !byId[d.id]);
              next[zonaName] = [...existing, ...devs];
            });
            return next;
          });
        } catch {}

        // Refrescar el promedio de la zona activa si un device afectado
        // pertenece a esa zona (sin cerrar la estación ni la vista actual).
        const zona = selZonaRef.current;
        if (zona) {
          const zonaName = zona.properties.zona;
          const idsEnZona = (zonaAqiDataRef.current[zonaName] || []).map(d => d.id);
          const hayAfectadoEnZona = affectedIds.some(id => idsEnZona.includes(id));
          if (hayAfectadoEnZona && idsEnZona.length) {
            try {
              const data = await devicesApi.zonaAqi(idsEnZona);
              if (data) setZonaAqiResult(data);
            } catch {}
          }
        }
      } catch {}
    }, 800);
  }, [lastValues]);

  useEffect(() => {
    const fetchPublicDevices = async () => {
      try {
        const res = await devicesApi.listPublic();
        const conGPS = res.filter(d => d.lat && d.lng);
        setLoading(false);
        const devicesWithAqi = await Promise.all(
          conGPS.map(async (d) => {
            try {
              const aqiData = await devicesApi.aqiPublic(d.id);
              return { ...d, aqi_value: aqiData.aqi ?? null, aqi_category: aqiData.category ?? null, liveVariables: aqiData.variables || {} };
            } catch { return { ...d, aqi_value: null, aqi_category: null, liveVariables: {} }; }
          })
        );
        setDevices(devicesWithAqi);
        const newZoneAqi = {};
        devicesWithAqi.forEach(d => {
          if (d.lat && d.lng) {
            const pt = turf.point([d.lng, d.lat]);
            XELA_ZONAS_GEOJSON.features.forEach(feature => {
              if (turf.booleanPointInPolygon(pt, feature)) {
                const zonaName = feature.properties.zona;
                if (!newZoneAqi[zonaName]) newZoneAqi[zonaName] = [];
                newZoneAqi[zonaName].push({ id: d.id, status: d.status, aqi_category: d.aqi_category, aqi_value: d.aqi_value });
              }
            });
          }
        });
        setZoneAqiData(newZoneAqi);
      } catch (err) {
        console.error('Error cargando dispositivos públicos:', err);
        setLoading(false);
      }
    };
    fetchPublicDevices();
  }, []);

  const loadedZonaRef = useRef(null);
  useEffect(() => {
    if (!selectedZonaFeature) {
      setZonaAqiResult(null);
      setSelectedDevice(null);
      return;
    }

    const zonaName = selectedZonaFeature.properties.zona;
    const idsEnZona = (zoneAqiData[zonaName] || []).map(d => d.id);

    if (!idsEnZona.length) {
      if (Object.keys(zoneAqiData).length > 0) {
        setZonaAqiResult({ aqi_promedio: null, aqi_max: null, category: 'Sin datos', clima: {}, online_count: 0, total_count: 0, devices: [] });
      }
      return;
    }

    // Solo resetear la selección cuando la zona elegida cambia de verdad.
    // Si solo se refrescó zoneAqiData (color en vivo), mantener la estación
    // que el usuario está observando.
    const zonaCambio = loadedZonaRef.current !== zonaName;
    loadedZonaRef.current = zonaName;

    const fetchZonaAqi = async () => {
      if (zonaCambio) {
        setLoadingZona(true);
        setZonaAqiResult(null);
        setSelectedDevice(null);
      }
      try {
        const data = await devicesApi.zonaAqi(idsEnZona);
        setZonaAqiResult(data);
      } catch (err) {
        console.error('Error obteniendo AQI de zona:', err);
        setZonaAqiResult({ aqi_promedio: null, aqi_max: null, category: 'Sin datos', clima: {}, online_count: 0, total_count: idsEnZona.length, devices: [] });
      } finally {
        setLoadingZona(false);
      }
    };
    fetchZonaAqi();
  }, [selectedZonaFeature, zoneAqiData]);

  const handleZonaClick = (feature) => setSelectedZonaFeature(feature);
  const handleSelectDeviceFromZona = (device) => {
    const zonaDev = zonaAqiResult?.devices?.find(zd => zd.id === device.id);
    setSelectedDevice({
      ...device,
      aqi_value: zonaDev?.aqi ?? device.aqi_value ?? null,
      aqi_category: zonaDev?.category ?? device.aqi_category ?? null,
      liveVariables: {
        ...(device.liveVariables || {}),
        ...(zonaDev && {
          temperatura: { value: zonaDev.temp },
          humedad:     { value: zonaDev.hum },
          co2:         { value: zonaDev.co2 },
          co:          { value: zonaDev.co },
        }),
      },
    });
  };
  const handleCloseDevice = () => setSelectedDevice(null);
  const handleCloseZona = () => {
    setSelectedZonaFeature(null);
    setZonaAqiResult(null);
    setSelectedDevice(null);
    setResetTrigger(t => t + 1);
  };

  const liveVars = selectedDevice?.liveVariables || {};
  const temp = liveVars.temperatura?.value ?? liveVars.temperature?.value ?? null;
  const hum  = liveVars.humedad?.value ?? liveVars.humidity?.value ?? null;
  const co2  = liveVars.co2?.value ?? null;
  const co   = liveVars.co?.value  ?? null;
  const currentAqiColor = selectedDevice?.status === 'online' ? getAqiColor(selectedDevice?.aqi_category) : '#9CA3AF';

  // Mantener el dispositivo seleccionado actualizado en tiempo real
  const selAqiRef = useRef(null);
  useEffect(() => {
    if (!selectedDevice) return;
    const mine = lastValues[selectedDevice.id];
    if (mine && Object.keys(mine).length) {
      setSelectedDevice(prev => {
        if (!prev) return prev;
        const prevVars = prev.liveVariables || {};
        const merged = { ...prevVars };
        Object.entries(mine).forEach(([v, val]) => {
          merged[v] = { value: val.value, time: val.time, ...(merged[v] || {}) };
        });
        return { ...prev, liveVariables: merged };
      });

      // Refrescar el AQI del dispositivo seleccionado (con debounce)
      clearTimeout(selAqiRef.current);
      selAqiRef.current = setTimeout(async () => {
        try {
          const aqiData = await devicesApi.aqiPublic(selectedDevice.id);
          if (aqiData && (aqiData.aqi ?? null) != null) {
            setSelectedDevice(prev => (prev
              ? { ...prev, aqi_value: aqiData.aqi, aqi_category: aqiData.category }
              : prev));
          }
        } catch {}
      }, 700);
    }

    return () => clearTimeout(selAqiRef.current);
  }, [lastValues, selectedDevice?.id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: COLORS.bgLight, fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '10px 16px' : '16px 6vw', backgroundColor: COLORS.white, borderBottom: `1px solid ${COLORS.border}`, zIndex: 1000, position: 'relative', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={logoImg} alt="AirSunBox" style={{ height: isMobile ? '32px' : '40px' }} />
          {!isMobile && <h1 style={{ margin: 0, fontSize: '1.2rem', color: COLORS.text, fontWeight: 'bold' }}>Mapa Ambiental Público</h1>}
          {connected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#2BA8A015', padding: '5px 10px', borderRadius: '99px', border: '1px solid #2BA8A040' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#2BA8A0', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#2BA8A0' }}>En vivo</span>
            </div>
          )}
        </div>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: COLORS.textMuted, textDecoration: 'none', fontSize: isMobile ? '0.8rem' : '0.9rem', fontWeight: '500' }}>
          <ArrowLeft size={isMobile ? 14 : 16} />
          {isMobile ? 'Inicio' : 'Volver al inicio'}
        </Link>
      </header>

      <div style={{ flex: 1, position: 'relative', isolation: selectedZonaFeature ? 'isolate' : 'auto', minHeight: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <p style={{ color: COLORS.textMuted }}>Cargando estaciones de monitoreo...</p>
          </div>
        ) : (
          <MapContainer center={[14.8347, -91.5181]} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false}>
            <TileLayer attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <UserLocationLayer onLocationFound={setUserLocation} onZonaDetected={setUserZona} onLocationDenied={() => setLocationDenied(true)} />
            <AllZonesFitLayer />
            <MapRefSetter />
            <XelaZonasLayer zonaHover={zonaHover} onZonaHover={setZonaHover} onZonaClick={handleZonaClick} selectedZona={selectedZonaFeature?.properties?.zona} />
            <ZonaZoomLayer zonaFeature={selectedZonaFeature} isDeviceSelected={!!selectedDevice} />
            <DeviceZoomLayer device={selectedDevice} />
            <ZonaSpotlightLayer zonaFeature={selectedZonaFeature} />
            <ResetZoomLayer trigger={resetTrigger} />
            {searchMarker && <SearchMarkerLayer marker={searchMarker} onClose={() => setSearchMarker(null)} />}
            {showHeatmap && <PerDeviceAuraLayer devices={devices} />}
            {selectedZonaFeature && devices
              .filter(d => { if (!d.lat || !d.lng) return false; return turf.booleanPointInPolygon(turf.point([d.lng, d.lat]), selectedZonaFeature); })
              .map(d => (
                <Marker key={d.id} position={[d.lat, d.lng]} icon={createAqiIcon(d.aqi_category, d.status)} eventHandlers={{ click: () => handleSelectDeviceFromZona(d) }} />
              ))
            }
          </MapContainer>
        )}

        <SearchBar isMobile={isMobile}
          onResult={(lat, lng, name) => {
            setSearchMarker({ lat, lng, name });
            if (mapRef.current) mapRef.current.flyTo([lat, lng], 17, { animate: true, duration: 1.2 });
          }}
          onClear={() => { setSearchMarker(null); setResetTrigger(t => t + 1); }}
        />

        <div style={{ position: 'absolute', top: isMobile ? 'auto' : '20px', bottom: isMobile ? '16px' : 'auto', left: '14px', zIndex: 1000, display: 'flex', flexDirection: isMobile ? 'row' : 'row', gap: '8px' }}>
          {/* Contenedor relativo del dropdown */}
<div style={{ position: 'relative', display: 'inline-block' }}>
  
  <button 
    onClick={() => setShowZonesPanel(p => !p)} 
    title="Zonas" 
    style={{ 
      display: 'flex', alignItems: 'center', gap: isMobile ? '0' : '8px', 
      padding: isMobile ? '10px' : '10px 16px', 
      backgroundColor: showZonesPanel ? COLORS.primary : COLORS.white, 
      color: showZonesPanel ? COLORS.white : COLORS.textMuted, 
      border: `1px solid ${showZonesPanel ? COLORS.primary : COLORS.border}`, 
      borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', 
      boxShadow: '0 4px 12px rgba(0,0,0,.1)', transition: 'all .2s' 
    }}
  >
    <Map size={18} />
    {!isMobile && ' Zonas'}
    <span style={{ fontSize: '10px', marginLeft: '6px', transform: showZonesPanel ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
  </button>

  {/* Dropdown de zonas mejorado */}
  {showZonesPanel && (
    <div style={{
      position: 'absolute', top: 'calc(100% + 10px)', left: 0,
      backgroundColor: COLORS.white, border: `1px solid ${COLORS.border}`,
      borderRadius: '16px', boxShadow: '0 -8px 32px rgba(0,0,0,.12)',
      padding: '8px', zIndex: 2000, minWidth: '240px',
      maxHeight: '60vh', overflowY: 'auto', scrollbarWidth: 'none',
    }}>
      {/* Cabecera */}
      <div style={{ padding: '8px 12px 10px', borderBottom: `1px solid ${COLORS.border}`, marginBottom: '6px' }}>
        <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Selector de Zonas</p>
        <p style={{ margin: '2px 0 0', fontSize: '0.9rem', fontWeight: '900', color: COLORS.text }}>Quetzaltenango</p>
      </div>
      {/* Todas las zonas */}
      <button
        onClick={() => { setSelectedZonaFeature(null); setResetTrigger(t => t + 1); setShowZonesPanel(false); }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', border: 'none', background: !selectedZonaFeature ? `${COLORS.primary}12` : 'transparent', borderRadius: '10px', textAlign: 'left', cursor: 'pointer', marginBottom: '2px' }}
      >
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.primary, flexShrink: 0 }} />
        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: COLORS.primary }}>Todas las zonas</span>
        <ChevronRight size={13} color={COLORS.primary} style={{ marginLeft: 'auto' }} />
      </button>
      {/* Lista de zonas */}
      {XELA_ZONAS_GEOJSON.features.map((feature) => {
        const zonaName   = feature.properties.zona;
        const isSelected = selectedZonaFeature?.properties?.zona === zonaName;
        const zonaDevs   = zoneAqiData[zonaName] || [];
        const onlineCnt  = zonaDevs.filter(d => d.status === 'online').length;
        const bestDev    = zonaDevs.find(d => d.status === 'online');
        const zonaColor  = bestDev ? getAqiColor(bestDev.aqi_category) : '#9CA3AF';
        return (
          <button key={zonaName}
            onClick={() => { setSelectedZonaFeature(feature); setShowZonesPanel(false); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', border: 'none', background: isSelected ? `${zonaColor}12` : 'transparent', borderRadius: '10px', textAlign: 'left', cursor: 'pointer', marginBottom: '2px', transition: 'background .15s' }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = COLORS.bgLight; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: zonaColor, flexShrink: 0, boxShadow: `0 0 0 3px ${zonaColor}25` }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '0.83rem', fontWeight: isSelected ? '700' : '500', color: COLORS.text }}>{zonaName}</p>
              <p style={{ margin: 0, fontSize: '0.68rem', color: COLORS.textMuted }}>
                {onlineCnt > 0 ? `${onlineCnt} estaci${onlineCnt > 1 ? 'ones activas' : 'on activa'}` : 'Sin estaciones activas'}
              </p>
            </div>
            <ChevronRight size={13} color={isSelected ? zonaColor : COLORS.textMuted} />
          </button>
        );
      })}
    </div>
  )}
</div>

{/* BOTÓN: Calidad de aire donde estoy (Sin acción aún) */}
<button 
  onClick={() => {}} 
  title="Quiero ver la calidad de aire donde yo estoy" 
  style={{ 
    display: 'flex', alignItems: 'center', gap: isMobile ? '0' : '8px', 
    padding: isMobile ? '10px' : '10px 16px', 
    backgroundColor: COLORS.white, 
    color: COLORS.textMuted, 
    border: `1px solid ${COLORS.border}`, 
    borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', 
    boxShadow: '0 4px 12px rgba(0,0,0,.1)', transition: 'all .2s' 
  }}
>
  <MapPin size={18} />
  {!isMobile && ' Quiero ver la calidad de aire donde yo estoy'}
</button>
          {selectedZonaFeature && (
            <button onClick={handleCloseZona} title="Ver todas las zonas" style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0' : '8px', padding: isMobile ? '10px' : '10px 16px', backgroundColor: COLORS.primary, color: COLORS.white, border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(103,183,232,.35)', transition: 'all .2s' }}>
              <Layers size={18} />{!isMobile && ' Ver todas'}
            </button>
          )}
          {!isMobile && userZona && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', backgroundColor: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,.08)', fontSize: '0.8rem', color: COLORS.text }}>
              <span>📍</span>
              <div><div style={{ fontWeight: '600', fontSize: '0.75rem', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Tu zona</div><div style={{ fontWeight: 'bold', color: COLORS.primary }}>{userZona}</div></div>
            </div>
          )}
        </div>

        {isMobile && userZona && (
          <div style={{ position: 'absolute', bottom: '16px', right: '14px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', backgroundColor: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,.08)', fontSize: '0.75rem' }}>
            <span>📍</span><span style={{ fontWeight: 'bold', color: COLORS.primary }}>{userZona}</span>
          </div>
        )}


        {selectedZonaFeature && !selectedDevice && (
          <ZonaPanel zonaFeature={selectedZonaFeature} zonaAqiResult={zonaAqiResult} loadingZona={loadingZona} onClose={handleCloseZona} onSelectDevice={handleSelectDeviceFromZona} devices={devices} isMobile={isMobile} />
        )}

        {selectedDevice && (
          <DevicePanel selectedDevice={selectedDevice} onBack={selectedZonaFeature ? () => setSelectedDevice(null) : null} isMobile={isMobile} currentAqiColor={currentAqiColor} temp={temp} hum={hum} co2={co2} co={co} />
        )}
      </div>

      <div style={{ backgroundColor: COLORS.white, borderTop: `1px solid ${COLORS.border}`, padding: isMobile ? '12px 16px' : '14px 6vw', display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '24px', flexShrink: 0, zIndex: 999, overflowX: isMobile ? 'auto' : 'visible', scrollbarWidth: 'none' }}>
        <span style={{ fontSize: '0.6rem', fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap', paddingRight: isMobile ? '12px' : '20px', borderRight: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
          {isMobile ? 'Apoyo' : 'Esta red de nodos de monitoreo es una realidad gracias al compromiso ambiental de'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '16px' : '24px', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', scrollbarWidth: 'none' }}>
          {PATROCINADORES.map(({ nombre, src }) => (
            <img key={nombre} src={src} alt={nombre} title={nombre} style={{ height: isMobile ? '26px' : '32px', maxWidth: isMobile ? '70px' : '90px', objectFit: 'contain', filter: 'grayscale(1) opacity(.5)', transition: 'filter .2s ease', flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.filter = 'grayscale(0) opacity(1)'} onMouseLeave={e => e.currentTarget.style.filter = 'grayscale(1) opacity(.5)'} />
          ))}
        </div>
      </div>
    </div>
  );
}