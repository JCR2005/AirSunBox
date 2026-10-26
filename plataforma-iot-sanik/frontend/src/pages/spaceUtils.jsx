import {
  Layers, MapPin, Type,
  Wind, Droplets, Mountain, Volume2,
  Sun, Leaf, Flame, Cloud, Waves, Thermometer, HeartPulse, Cpu, Server, Gauge,
  Moon, Star, Sunrise, Sunset, CloudRain, CloudSnow, CloudLightning, CloudSun, Cloudy, Snowflake,
  Bug, Sprout, Flower2, Factory, Building2, Warehouse, Rabbit, Briefcase, Zap,
  BatteryFull, Timer, Hourglass, Lock, Shield, ShieldAlert, Key, Radar, Network, Satellite, Bluetooth, Target, Database, Brain
} from 'lucide-react'

export const TYPE_LABELS = { aire: 'Aire', agua: 'Agua', suelo: 'Suelo', ruido: 'Ruido', otro: 'Otro' }

// Tipos de monitoreo disponibles (crear y editar espacio)
export const SPACE_TYPES = [
  { v: 'aire',  label: 'Aire',  icon: Wind, color: '#67B7E8' },
  { v: 'agua',  label: 'Agua',  icon: Droplets, color: '#43B6A0' },
  { v: 'suelo', label: 'Suelo', icon: Mountain, color: '#B08460' },
  { v: 'ruido', label: 'Ruido', icon: Volume2, color: '#C0637D' },
  { v: 'otro',  label: 'Otro',  icon: Type, color: '#8B5CF6' }
]

// Galería de iconos disponibles para un espacio (crear y editar)
export const SPACE_ICONS = [
  { n: 'aire',     Icon: Wind },
  { n: 'gota',     Icon: Droplets },
  { n: 'viento',   Icon: Wind },
  { n: 'sol',      Icon: Sun },
  { n: 'hoja',     Icon: Leaf },
  { n: 'llama',    Icon: Flame },
  { n: 'thermo',   Icon: Thermometer },
  { n: 'nube',     Icon: Cloud },
  { n: 'onda',     Icon: Waves },
  { n: 'ruido',    Icon: Volume2 },
  { n: 'servidor', Icon: Server },
  { n: 'heart',    Icon: HeartPulse },
  { n: 'luna',     Icon: Moon },
  { n: 'estrella', Icon: Star },
  { n: 'amanecer', Icon: Sunrise },
  { n: 'atardecer',Icon: Sunset },
  { n: 'lluvia',   Icon: CloudRain },
  { n: 'nieve',    Icon: CloudSnow },
  { n: 'tormenta', Icon: CloudLightning },
  { n: 'solnube',  Icon: CloudSun },
  { n: 'nublado',  Icon: Cloudy },
  { n: 'copo',     Icon: Snowflake },
  { n: 'insecto',  Icon: Bug },
  { n: 'brote',    Icon: Sprout },
  { n: 'flor',     Icon: Flower2 },
  { n: 'fabrica',  Icon: Factory },
  { n: 'edificio', Icon: Building2 },
  { n: 'deposito', Icon: Warehouse },
  { n: 'conejo',   Icon: Rabbit },
  { n: 'negocio',  Icon: Briefcase },
  { n: 'relampago',Icon: Zap },
  { n: 'bateria',  Icon: BatteryFull },
  { n: 'tiempo',   Icon: Timer },
  { n: 'horas',    Icon: Hourglass },
  { n: 'candado',  Icon: Lock },
  { n: 'escudo',   Icon: Shield },
  { n: 'alerta',   Icon: ShieldAlert },
  { n: 'llave',    Icon: Key },
  { n: 'radar',    Icon: Radar },
  { n: 'red',      Icon: Network },
  { n: 'blue',     Icon: Bluetooth },
  { n: 'satelite', Icon: Satellite },
  { n: 'blanco',   Icon: Target },
  { n: 'base',     Icon: Database },
  { n: 'cerebro',  Icon: Brain },
  { n: 'medidor',  Icon: Gauge },
  { n: 'tierra',   Icon: Leaf }
]

// Colores de acento sugeridos para un espacio
export const SPACE_COLORS = ['#67B7E8', '#43B6A0', '#B08460', '#C0637D', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#6366F1', '#14B8A6']

export const generateLabel = (text) => text
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
   .replace(/(^-|-$)+/g, '')

// Nombre normalizado para comparar variables (ignora tildes, espacios y puntuación)
export const normalizeVarName = (text) => String(text || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '')

export const iconByLabel = {
  aire: Wind, tierra: Leaf, agua: Droplets, suelo: Mountain, ruido: Volume2,
  otro: Layers, 'map-pin': MapPin,
  sensor: Cpu, gota: Droplets, viento: Wind, sol: Sun, hoja: Leaf, llama: Flame,
  thermo: Thermometer, nube: Cloud, onda: Waves, servidor: Server,
  heart: HeartPulse, luna: Moon, estrella: Star, amanecer: Sunrise, atardecer: Sunset,
  lluvia: CloudRain, nieve: CloudSnow, tormenta: CloudLightning, solnube: CloudSun,
  nublado: Cloudy, copo: Snowflake, insecto: Bug, brote: Sprout, flor: Flower2,
  fabrica: Factory, edificio: Building2, deposito: Warehouse, conejo: Rabbit,
  negocio: Briefcase, relampago: Zap, bateria: BatteryFull, tiempo: Timer,
  horas: Hourglass, candado: Lock, escudo: Shield, alerta: ShieldAlert, llave: Key,
  radar: Radar, red: Network, blue: Bluetooth, satelite: Satellite, blanco: Target,
  base: Database, cerebro: Brain, medidor: Gauge
}

export const spaceIcon = (label, fallback, size = 18) => {
  const C = (label && iconByLabel[label]) ? iconByLabel[label]
            : (iconByLabel[fallback] || Layers)
  return <C size={size} />
}

export const DEFAULT_PHRASES = [
  'El aire es ideal. No hay impacto en la salud respiratoria.',
  'Calidad aceptable. Riesgo mínimo para grupos vulnerables.',
  'Personas con asma deben limitar el esfuerzo prolongado.',
  'Riesgo respiratorio. Reducir actividades al aire libre.',
  'Peligro inminente. Permanecer en interiores.',
  'Nivel de riesgo elevado. Tomar precauciones.'
]

export const DEFAULT_CATS = [
  { name: 'Bien',   color: '#10B981', phrases: [DEFAULT_PHRASES[0], DEFAULT_PHRASES[1]] },
  { name: 'Precaución', color: '#F59E0B', phrases: [DEFAULT_PHRASES[2], DEFAULT_PHRASES[3]] },
  { name: 'Mal',    color: '#EF4444', phrases: [DEFAULT_PHRASES[4]] }
]

export function buildTram(n) {
  const out = []
  for (let i = 0; i < n; i++) {
    out.push({
      score_lo: Math.round((100 / n) * i),
      score_hi: Math.round((100 / n) * (i + 1)) - 1
    })
  }
  out[n - 1].score_hi = 100
  return out
}

export function toConfig(categories, includedVars, ranges) {
  return {
    categories: categories.map((c, i) => ({
      name: c.name, color: c.color, score_lo: c.score_lo, score_hi: c.score_hi,
      phrases: Array.isArray(c.phrases) ? c.phrases : []
    })),
    variables: includedVars.map((v, i) => ({ variable_label: v.label })),
    ranges
  }
}