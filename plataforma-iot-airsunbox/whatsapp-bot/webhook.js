/**
 * Xela Aire — Webhook para Botpress
 *
 * Rutas del backend (según publicRoutes.js + app.js):
 *   GET /api/public/devices            → lista devices con GPS y nombre
 *   GET /api/public/zones/aqi?ids=a,b  → AQI de una zona con detalle por device
 *
 * Botpress llama:
 *   GET /zona?nombre=Zona%203   → resumen de una zona + estaciones
 *   GET /general                → mejor y peor zona ahora
 *   GET /zonas                  → lista de zonas disponibles
 *   GET /health                 → healthcheck
 */

import express   from 'express';
import fetch     from 'node-fetch';
import * as turf from '@turf/turf';
import ZONAS_GEOJSON from './zonas_quetzaltenango_quetzaltenango.json' with { type: 'json' };

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const API_BASE = process.env.API_BASE ?? 'https://torchless-unpiteously-raphael.ngrok-free.dev';

const LT_HEADERS = { 'bypass-tunnel-reminder': 'true' };

const RECOMENDACIONES = {
  'Excelente':  'Aire ideal. Perfecta para actividades al aire libre sin restricciones.',
  'Buena':      'Calidad aceptable. La mayoría puede hacer actividades normales sin riesgo.',
  'Precaución': 'Grupos sensibles (niños, adultos mayores, asmáticos) deben limitar el esfuerzo prolongado al aire libre.',
  'Mala':       'Todos pueden sentir efectos. Reducir actividades en exteriores y usar mascarilla.',
  'Peligrosa':  'Riesgo alto para toda la población. Permanecer en interiores y evitar salir sin protección.',
  'Sin datos':  'No hay estaciones activas en esta zona en este momento.',
};

const EMOJI_CATEGORIA = {
  'Excelente':  '🟢',
  'Buena':      '🟡',
  'Precaución': '🟠',
  'Mala':       '🔴',
  'Peligrosa':  '🚨',
  'Sin datos':  '⚫',
};

// ─── HELPERS DE API ───────────────────────────────────────────────────────────

async function listPublic() {
  const url = `${API_BASE}/api/public/devices`;
  const res = await fetch(url, { headers: LT_HEADERS });
  if (!res.ok) throw new Error(`listPublic falló: ${res.status} — ${url}`);
  return res.json();
}

async function zonaAqi(ids) {
  const params = ids.join(',');
  const url = `${API_BASE}/api/public/zones/aqi?ids=${params}`;
  const res = await fetch(url, { headers: LT_HEADERS });
  if (!res.ok) throw new Error(`zonaAqi falló: ${res.status} — ${url}`);
  return res.json();
}

// ─── LÓGICA CENTRAL ───────────────────────────────────────────────────────────

async function getResumenZona(nombreZona) {
  // 1. Traer todos los devices con GPS y nombre
  const todosDevices = await listPublic();
  const conGPS = todosDevices.filter(d => d.lat && d.lng);

  // Mapa id → nombre para lookup rápido
  const nombrePorId = {};
  todosDevices.forEach(d => { nombrePorId[d.id] = d.name || d.id; });

  // 2. Encontrar el feature GeoJSON de la zona
  const zonaFeature = ZONAS_GEOJSON.features.find(
    f => f.properties.zona?.toLowerCase() === nombreZona.toLowerCase()
  );

  if (!zonaFeature) {
    return { error: 'zona_no_encontrada', zonas_disponibles: listarZonas() };
  }

  // 3. Filtrar devices dentro de la zona con turf
  const devicesEnZona = conGPS.filter(d => {
    const pt = turf.point([d.lng, d.lat]);
    return turf.booleanPointInPolygon(pt, zonaFeature);
  });

  if (devicesEnZona.length === 0) {
    return {
      zona:          nombreZona,
      categoria:     'Sin datos',
      emoji:         '⚫',
      aqi_promedio:  null,
      online_count:  0,
      total_count:   0,
      clima:         {},
      estaciones:    [],
      recomendacion: RECOMENDACIONES['Sin datos'],
      mensaje_wa:    formatearMensajeWA(nombreZona, null, []),
    };
  }

  // 4. Pedir el AQI agregado de la zona
  const ids  = devicesEnZona.map(d => d.id);
  const data = await zonaAqi(ids);

  // 5. Construir lista de estaciones con nombre
  const estaciones = (data.devices || []).map(d => ({
    id:        d.id,
    nombre:    nombrePorId[d.id] || d.id,
    aqi:       d.aqi,
    categoria: d.category,
    hasData:   d.hasData,
    temp:      d.temp,
    hum:       d.hum,
    co2:       d.co2,
    co:        d.co,
  }));

  return {
    zona:          nombreZona,
    categoria:     data.category     ?? 'Sin datos',
    emoji:         EMOJI_CATEGORIA[data.category] ?? '⚫',
    aqi_promedio:  data.aqi_promedio ?? null,
    online_count:  data.online_count ?? 0,
    total_count:   data.total_count  ?? devicesEnZona.length,
    clima: {
      temp: data.clima?.temp_promedio ?? null,
      hum:  data.clima?.hum_promedio  ?? null,
      co2:  data.clima?.co2_promedio  ?? null,
      co:   data.clima?.co_promedio   ?? null,
    },
    estaciones,
    recomendacion: RECOMENDACIONES[data.category] ?? RECOMENDACIONES['Sin datos'],
    mensaje_wa:    formatearMensajeWA(nombreZona, data, estaciones),
  };
}

async function getResumenGeneral() {
  const todosDevices = await listPublic();
  const conGPS = todosDevices.filter(d => d.lat && d.lng);
  const zonasConDatos = {};

  for (const feature of ZONAS_GEOJSON.features) {
    const nombreZona = feature.properties.zona;
    const devicesEnZona = conGPS.filter(d =>
      turf.booleanPointInPolygon(turf.point([d.lng, d.lat]), feature)
    );
    if (devicesEnZona.length === 0) continue;

    const ids = devicesEnZona.map(d => d.id);
    try {
      const data = await zonaAqi(ids);
      if (data.aqi_promedio !== null && data.aqi_promedio !== undefined) {
        zonasConDatos[nombreZona] = {
          aqi:       data.aqi_promedio,
          categoria: data.category,
        };
      }
    } catch { /* seguir con las demás */ }
  }

  const zonas = Object.entries(zonasConDatos);
  if (zonas.length === 0) {
    return {
      mensaje_wa: '⚫ No hay estaciones activas en este momento en Xela.\n\nVer mapa: https://voluble-creponne-e6c74f.netlify.app/mapa',
    };
  }

  zonas.sort((a, b) => a[1].aqi - b[1].aqi);
  const mejor = zonas[0];
  const peor  = zonas[zonas.length - 1];

  const lineas = [
    `🌬️ *Calidad del aire en Xela ahora*`,
    ``,
    `✅ Mejor: ${mejor[0]} — ${mejor[1].categoria} (AQI ${mejor[1].aqi})`,
    `⚠️ Peor:  ${peor[0]}  — ${peor[1].categoria} (AQI ${peor[1].aqi})`,
    ``,
    `Zonas monitoreadas: ${zonas.length}`,
    ``,
    `Ver mapa completo: https://voluble-creponne-e6c74f.netlify.app/mapa`,
    `Escribí el nombre de una zona para más detalle.`,
  ];

  return { mensaje_wa: lineas.join('\n'), zonas: zonasConDatos };
}

function listarZonas() {
  return ZONAS_GEOJSON.features.map(f => f.properties.zona).filter(Boolean);
}

// ─── FORMATEADOR DE MENSAJE WHATSAPP ─────────────────────────────────────────
function emojiAqi(aqi) {
  if (aqi === null || aqi === undefined) return '⚫';
  if (aqi <= 20) return '🟢';
  if (aqi <= 40) return '🟡';
  if (aqi <= 60) return '🟠';
  if (aqi <= 80) return '🔴';
  return '🚨';
}

function formatearMensajeWA(nombreZona, data, estaciones = []) {
  if (!data || data.aqi_promedio === null || data.aqi_promedio === undefined) {
    return [
      `⚫ *${nombreZona}*`,
      `Sin estaciones activas en este momento.`,
      ``,
      `Ver mapa: https://voluble-creponne-e6c74f.netlify.app/mapa`,
    ].join('\n');
  }

  const emoji = EMOJI_CATEGORIA[data.category] ?? '⚫';
  const clima = data.clima ?? {};

  const lineas = [
    `${emoji} *Aire en ${nombreZona}*`,
    ``,
    `Calidad: *${data.category}*`,
    `AQI promedio: ${data.aqi_promedio}`,
  ];

  if (clima.temp_promedio != null) lineas.push(`🌡️ Temp: ${clima.temp_promedio}°C`);
  if (clima.hum_promedio  != null) lineas.push(`💧 Hum:  ${clima.hum_promedio}%`);
  if (clima.co2_promedio  != null) lineas.push(`🫁 CO₂:  ${clima.co2_promedio} ppm`);
  if (clima.co_promedio   != null) lineas.push(`💨 CO:   ${clima.co_promedio} ppm`);

  // Lista de estaciones activas
  const activas = estaciones.filter(e => e.hasData);
  if (activas.length > 0) {
    lineas.push(``, `📍 *Estaciones (${activas.length} activas):*`);
    activas.forEach(e => {
      lineas.push(`${emojiAqi(e.aqi)} ${e.nombre} — AQI ${e.aqi} (${e.categoria})`);
    });
  }

  // Estaciones sin datos
  const sinDatos = estaciones.filter(e => !e.hasData);
  if (sinDatos.length > 0) {
    lineas.push(``, `⚫ *Sin datos:*`);
    sinDatos.forEach(e => lineas.push(`• ${e.nombre}`));
  }

  lineas.push(``, RECOMENDACIONES[data.category] ?? '');
  lineas.push(``, `Ver mapa: https://voluble-creponne-e6c74f.netlify.app/mapa`);

  return lineas.join('\n');
}

// ─── SERVIDOR EXPRESS ─────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT ?? 3001;
app.use(express.json());

app.get('/zona', async (req, res) => {
  const nombre = req.query.nombre?.trim();
  if (!nombre) {
    return res.status(400).json({
      error: 'Parámetro "nombre" requerido',
      zonas_disponibles: listarZonas(),
    });
  }
  try {
    const resultado = await getResumenZona(nombre);
    res.json(resultado);
  } catch (err) {
    console.error('[/zona]', err.message);
    res.status(500).json({ error: 'Error consultando la API', detalle: err.message });
  }
});

app.get('/general', async (_req, res) => {
  try {
    const resultado = await getResumenGeneral();
    res.json(resultado);
  } catch (err) {
    console.error('[/general]', err.message);
    res.status(500).json({ error: 'Error consultando la API', detalle: err.message });
  }
});

app.get('/zonas', (_req, res) => {
  res.json({ zonas: listarZonas() });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Webhook escuchando en :${PORT}`));