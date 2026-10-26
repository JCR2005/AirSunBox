export interface DeviceVariableAgg {
  avg: number
  max?: number
  min?: number
}

export interface DeviceReportData {
  id: string
  name: string
  lat?: number | null
  lng?: number | null
  variables: Record<string, DeviceVariableAgg>
}

export interface RespiratoryRiskResult {
  id: string
  name: string
  riskLevel: string
  riskScore: number
  criticalVar: string | null
  disease: string
  conclusion: string
}

export function calculateRespiratoryRisk(devicesData: Record<string, DeviceReportData>): RespiratoryRiskResult[] {
  const riskLevels = ['Indeterminado', 'Bajo', 'Moderado', 'Alto', 'Muy Alto']

  return Object.values(devicesData).map(dev => {
    let riskScore = 1
    let criticalVar: string | null = null
    let disease = '--'
    let recommendation = 'Niveles aceptables'
    let details: Array<{ disease: string; reason: string }> = []

    const vars = dev.variables

    if (vars.pm25) {
      const val = vars.pm25.avg
      if (val > 35) {
        riskScore = Math.max(riskScore, 3)
        criticalVar = 'PM2.5'
        details.push({ disease: 'Asma', reason: 'Niveles elevados de material particulado fino' })
      } else if (val > 12) {
        riskScore = Math.max(riskScore, 2)
      }
    }

    if (vars.pm10) {
      const val = vars.pm10.avg
      if (val > 154) {
        riskScore = Math.max(riskScore, 3)
        if (!criticalVar) criticalVar = 'PM10'
        details.push({ disease: 'Inflamación pulmonar', reason: 'Partículas gruesas por encima del límite' })
      } else if (val > 54) {
        riskScore = Math.max(riskScore, 2)
      }
    }

    if (vars.so2) {
      const val = vars.so2.avg
      if (val > 185) {
        riskScore = Math.max(riskScore, 3)
        if (!criticalVar) criticalVar = 'SO₂'
        details.push({ disease: 'Broncoconstricción', reason: 'Dióxido de azufre en niveles críticos' })
      }
    }

    if (vars.humedad || vars.humidity) {
      const val = (vars.humedad || vars.humidity).avg
      if (val > 70) {
        details.push({ disease: 'Agravamiento de Bronquitis', reason: 'Humedad relativa excesiva (>70%)' })
        if (riskScore < 2) riskScore = 2
      }
    }

    if ((vars.temperatura || vars.temperature) && vars.pm25) {
      const temp = (vars.temperatura || vars.temperature).avg
      const pm = vars.pm25.avg
      if (temp > 30 && pm > 25) {
        details.push({ disease: 'Riesgo de EPOC', reason: 'Combinación de calor extremo y contaminación' })
        riskScore = Math.max(riskScore, 3)
      }
    }

    if (details.length > 0) {
      disease = details[0].disease
      const reasons = details.map(d => d.disease).join(', ')

      if (riskScore >= 3) {
        recommendation = `Riesgo elevado de ${reasons}. Se recomienda el uso de mascarilla N95, evitar actividades al aire libre y mantener ventanas cerradas.`
      } else {
        recommendation = `Riesgo moderado de ${reasons}. Se sugiere a personas sensibles reducir esfuerzos prolongados al exterior.`
      }
    }

    if (vars.pm25 && vars.pm25.avg > 35) {
      disease = 'Asma'
      recommendation = 'Uso de mascarilla y reducción de actividades al aire libre debido a PM2.5 elevado.'
    } else if ((vars.humedad?.avg || vars.humidity?.avg) > 75) {
      disease = 'Bronquitis'
      recommendation = 'Mantener espacios ventilados y controlar la humedad para evitar agravamiento de bronquitis.'
    } else if ((vars.temperatura?.avg || vars.temperature?.avg) > 32 && vars.pm25?.avg > 25) {
      disease = 'EPOC'
      recommendation = 'Evitar exposición prolongada al exterior por combinación de calor y contaminación.'
    }

    return {
      ...dev,
      riskLevel: riskLevels[riskScore],
      riskScore,
      criticalVar,
      disease,
      conclusion: recommendation
    }
  })
}