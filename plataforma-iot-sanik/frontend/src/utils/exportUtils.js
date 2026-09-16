import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'

/**
 * Formatea fechas para visualización en reportes
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Sin especificar'
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-GT')
  } catch (e) {
    return dateStr
  }
}

/**
 * Agrega encabezado y pie de página estándar a las páginas del PDF
 */
function addPdfHeaderFooter(doc, reportTitle, pageNum, totalPages) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Encabezado
  doc.setFillColor(103, 183, 232) // #67B7E8
  doc.rect(0, 0, pageWidth, 12, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('AirSunBox — Plataforma IoT Sanik', 14, 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(reportTitle, pageWidth - 14, 8, { align: 'right' })

  // Pie de página
  doc.setDrawColor(220, 220, 220)
  doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12)
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(`Generado el ${new Date().toLocaleString('es-GT')}`, 14, pageHeight - 6)
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - 14, pageHeight - 6, { align: 'right' })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HEAT ISLANDS — PDF EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export async function exportHeatmapPDF({ data = [], filters = {}, orgName = 'Todas', mapElement = null }) {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  let y = 20

  // Título del Reporte
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(30, 41, 59)
  doc.text('Reporte de Islas de Calor', 14, y)
  y += 7

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Análisis térmico ambiental y distribución de temperaturas en la red', 14, y)
  y += 10

  // Cuadro de Filtros
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, y, pageWidth - 28, 18, 2, 2, 'FD')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(51, 65, 85)
  doc.text('Organización:', 18, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.text(String(orgName || 'Todas las organizaciones'), 42, y + 7)

  doc.setFont('helvetica', 'bold')
  doc.text('Desde:', 18, y + 13)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(filters.start), 32, y + 13)

  doc.setFont('helvetica', 'bold')
  doc.text('Hasta:', 80, y + 13)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(filters.end), 92, y + 13)

  y += 24

  // Métricas de Resumen
  const avgTemp = data.length > 0 ? (data.reduce((acc, curr) => acc + parseFloat(curr.avg_temp || 0), 0) / data.length).toFixed(1) : '—'
  const maxTemp = data.length > 0 ? Math.max(...data.map(d => parseFloat(d.max_temp || 0))).toFixed(1) : '—'
  const minTemp = data.length > 0 ? Math.min(...data.map(d => parseFloat(d.min_temp || 0))).toFixed(1) : '—'

  const boxWidth = (pageWidth - 28 - 10) / 3

  // Box 1: Temp Promedio
  doc.setFillColor(239, 246, 255)
  doc.setDrawColor(191, 219, 254)
  doc.roundedRect(14, y, boxWidth, 18, 2, 2, 'FD')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 64, 175)
  doc.text('TEMP. PROMEDIO', 18, y + 6)
  doc.setFontSize(14)
  doc.text(`${avgTemp}°C`, 18, y + 14)

  // Box 2: Temp Máxima
  doc.setFillColor(254, 242, 242)
  doc.setDrawColor(254, 202, 202)
  doc.roundedRect(14 + boxWidth + 5, y, boxWidth, 18, 2, 2, 'FD')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(153, 27, 27)
  doc.text('MÁXIMA REGISTRADA', 18 + boxWidth + 5, y + 6)
  doc.setFontSize(14)
  doc.text(`${maxTemp}°C`, 18 + boxWidth + 5, y + 14)

  // Box 3: Temp Mínima
  doc.setFillColor(240, 253, 244)
  doc.setDrawColor(187, 247, 208)
  doc.roundedRect(14 + (boxWidth + 5) * 2, y, boxWidth, 18, 2, 2, 'FD')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(22, 101, 52)
  doc.text('MÍNIMA REGISTRADA', 18 + (boxWidth + 5) * 2, y + 6)
  doc.setFontSize(14)
  doc.text(`${minTemp}°C`, 18 + (boxWidth + 5) * 2, y + 14)

  y += 24

  // Captura opcional del mapa
  if (mapElement) {
    try {
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        scale: 1.5,
        logging: false
      })
      const imgData = canvas.toDataURL('image/png')
      const imgWidth = pageWidth - 28
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const maxMapHeight = 65

      const finalMapHeight = Math.min(imgHeight, maxMapHeight)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(51, 65, 85)
      doc.text('Visualización del Mapa de Calor', 14, y)
      y += 4

      doc.addImage(imgData, 'PNG', 14, y, imgWidth, finalMapHeight)
      y += finalMapHeight + 8
    } catch (e) {
      console.warn('No se pudo capturar la imagen del mapa para el PDF:', e)
    }
  }

  // Conclusión ambiental
  const hasHighTemp = data.some(d => parseFloat(d.avg_temp) > 28)
  const conclusionText = hasHighTemp
    ? 'Se detectan islas de calor moderadas en las zonas industriales registradas. Se recomienda aumentar la cobertura vegetal en estas áreas.'
    : 'Las temperaturas se mantienen dentro de los rangos normales para la región durante este periodo.'

  if (y > pageHeight - 50) {
    doc.addPage()
    y = 20
  }

  doc.setFillColor(254, 243, 199) // amber-100
  doc.setDrawColor(252, 211, 77)
  doc.roundedRect(14, y, pageWidth - 28, 16, 2, 2, 'FD')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(146, 64, 14)
  doc.text('Conclusión Ambiental:', 18, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const splitText = doc.splitTextToSize(conclusionText, pageWidth - 36)
  doc.text(splitText, 18, y + 10)

  y += 22

  // Tabla de Detalles por Estación
  if (y > pageHeight - 40) {
    doc.addPage()
    y = 20
  }

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('Detalles por Estación', 14, y)
  y += 6

  // Cabecera de la tabla
  const headers = ['ID', 'Estación / Nombre', 'Latitud', 'Longitud', 'Temp. Avg', 'Hum. Avg', 'Max Temp', 'Min Temp']
  const colWidths = [24, 48, 20, 20, 18, 18, 18, 18] // Total: 184 mm

  doc.setFillColor(226, 232, 240)
  doc.rect(14, y, pageWidth - 28, 7, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)

  let curX = 16
  headers.forEach((h, idx) => {
    doc.text(h, curX, y + 5)
    curX += colWidths[idx]
  })
  y += 7

  // Filas de la tabla
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  data.forEach((row, i) => {
    if (y > pageHeight - 20) {
      doc.addPage()
      y = 20
      // Repetir cabecera
      doc.setFillColor(226, 232, 240)
      doc.rect(14, y, pageWidth - 28, 7, 'F')
      doc.setFont('helvetica', 'bold')
      let headerX = 16
      headers.forEach((h, idx) => {
        doc.text(h, headerX, y + 5)
        headerX += colWidths[idx]
      })
      y += 7
      doc.setFont('helvetica', 'normal')
    }

    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(14, y, pageWidth - 28, 6, 'F')
    }

    doc.setTextColor(51, 65, 85)
    let cellX = 16

    const shortId = String(row.id || '').split('-')[0]
    const name = String(row.name || '').substring(0, 24)
    const lat = row.lat ? parseFloat(row.lat).toFixed(4) : '—'
    const lng = row.lng ? parseFloat(row.lng).toFixed(4) : '—'
    const avgT = row.avg_temp ? `${parseFloat(row.avg_temp).toFixed(1)}°C` : '—'
    const avgH = row.avg_hum ? `${parseFloat(row.avg_hum).toFixed(0)}%` : '—'
    const maxT = row.max_temp ? `${parseFloat(row.max_temp).toFixed(1)}°C` : '—'
    const minT = row.min_temp ? `${parseFloat(row.min_temp).toFixed(1)}°C` : '—'

    doc.text(shortId, cellX, y + 4.5); cellX += colWidths[0]
    doc.text(name, cellX, y + 4.5); cellX += colWidths[1]
    doc.text(lat, cellX, y + 4.5); cellX += colWidths[2]
    doc.text(lng, cellX, y + 4.5); cellX += colWidths[3]
    doc.text(avgT, cellX, y + 4.5); cellX += colWidths[4]
    doc.text(avgH, cellX, y + 4.5); cellX += colWidths[5]
    doc.text(maxT, cellX, y + 4.5); cellX += colWidths[6]
    doc.text(minT, cellX, y + 4.5); cellX += colWidths[7]

    y += 6
  })

  // Aplicar encabezado y pie de página
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addPdfHeaderFooter(doc, 'Islas de Calor', i, totalPages)
  }

  doc.save(`reporte_islas_de_calor_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. HEAT ISLANDS — EXCEL EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export function exportHeatmapExcel({ data = [], filters = {}, orgName = 'Todas' }) {
  const wb = XLSX.utils.book_new()

  const avgTemp = data.length > 0 ? (data.reduce((acc, curr) => acc + parseFloat(curr.avg_temp || 0), 0) / data.length).toFixed(1) : '—'
  const maxTemp = data.length > 0 ? Math.max(...data.map(d => parseFloat(d.max_temp || 0))).toFixed(1) : '—'
  const minTemp = data.length > 0 ? Math.min(...data.map(d => parseFloat(d.min_temp || 0))).toFixed(1) : '—'

  const hasHighTemp = data.some(d => parseFloat(d.avg_temp) > 28)
  const conclusionText = hasHighTemp
    ? 'Se detectan islas de calor moderadas en las zonas industriales registradas. Se recomienda aumentar la cobertura vegetal en estas áreas.'
    : 'Las temperaturas se mantienen dentro de los rangos normales para la región durante este periodo.'

  // Hoja 1: Resumen
  const resumenRows = [
    ['REPORTE DE ISLAS DE CALOR'],
    [''],
    ['Fecha de Generación:', new Date().toLocaleString('es-GT')],
    ['Organización:', orgName],
    ['Rango Desde:', formatDate(filters.start)],
    ['Rango Hasta:', formatDate(filters.end)],
    [''],
    ['MÉTRICAS DE RESUMEN'],
    ['Temperatura Promedio General (°C):', avgTemp],
    ['Temperatura Máxima Registrada (°C):', maxTemp],
    ['Temperatura Mínima Registrada (°C):', minTemp],
    ['Total de Estaciones Monitoreadas:', data.length],
    [''],
    ['Conclusión Ambiental:', conclusionText]
  ]

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows)
  wsResumen['!cols'] = [{ wch: 36 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // Hoja 2: Estaciones
  const estacionesHeaders = [
    'ID Estación',
    'Nombre Estación',
    'Latitud',
    'Longitud',
    'Temp. Promedio (°C)',
    'Humedad Promedio (%)',
    'Temp. Máxima (°C)',
    'Temp. Mínima (°C)'
  ]

  const estacionesRows = data.map(d => [
    d.id,
    d.name,
    d.lat ? parseFloat(d.lat) : '',
    d.lng ? parseFloat(d.lng) : '',
    d.avg_temp ? parseFloat(parseFloat(d.avg_temp).toFixed(1)) : '',
    d.avg_hum ? parseFloat(parseFloat(d.avg_hum).toFixed(1)) : '',
    d.max_temp ? parseFloat(parseFloat(d.max_temp).toFixed(1)) : '',
    d.min_temp ? parseFloat(parseFloat(d.min_temp).toFixed(1)) : ''
  ])

  const wsEstaciones = XLSX.utils.aoa_to_sheet([estacionesHeaders, ...estacionesRows])
  wsEstaciones['!cols'] = [
    { wch: 38 }, // ID
    { wch: 30 }, // Nombre
    { wch: 12 }, // Lat
    { wch: 12 }, // Lng
    { wch: 20 }, // Temp Avg
    { wch: 20 }, // Hum Avg
    { wch: 18 }, // Max Temp
    { wch: 18 }  // Min Temp
  ]
  XLSX.utils.book_append_sheet(wb, wsEstaciones, 'Estaciones')

  XLSX.writeFile(wb, `reporte_islas_de_calor_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. RESPIRATORY RISK — PDF EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export function exportRespiratoryRiskPDF({ data = [], filters = {}, orgName = 'Todas' }) {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  let y = 20

  // Título
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(30, 41, 59)
  doc.text('Reporte de Riesgo Respiratorio', 14, y)
  y += 7

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Evaluación de calidad del aire y vulnerabilidad para la salud humana', 14, y)
  y += 10

  // Cuadro de Filtros
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, y, pageWidth - 28, 18, 2, 2, 'FD')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(51, 65, 85)
  doc.text('Organización:', 18, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.text(String(orgName || 'Todas las organizaciones'), 42, y + 7)

  doc.setFont('helvetica', 'bold')
  doc.text('Desde:', 18, y + 13)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(filters.start), 32, y + 13)

  doc.setFont('helvetica', 'bold')
  doc.text('Hasta:', 80, y + 13)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(filters.end), 92, y + 13)

  y += 24

  // Conteos de Riesgo
  const countBajo = data.filter(d => d.riskLevel === 'Bajo').length
  const countMod = data.filter(d => d.riskLevel === 'Moderado').length
  const countAlto = data.filter(d => d.riskLevel === 'Alto' || d.riskLevel === 'Muy Alto').length

  const boxW = (pageWidth - 28 - 10) / 3

  // Box Bajo
  doc.setFillColor(236, 253, 245)
  doc.setDrawColor(167, 243, 208)
  doc.roundedRect(14, y, boxW, 16, 2, 2, 'FD')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(6, 95, 70)
  doc.text('RIESGO BAJO', 18, y + 6)
  doc.setFontSize(12)
  doc.text(`${countBajo} estación(es)`, 18, y + 13)

  // Box Moderado
  doc.setFillColor(254, 243, 199)
  doc.setDrawColor(253, 230, 138)
  doc.roundedRect(14 + boxW + 5, y, boxW, 16, 2, 2, 'FD')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(146, 64, 14)
  doc.text('RIESGO MODERADO', 18 + boxW + 5, y + 6)
  doc.setFontSize(12)
  doc.text(`${countMod} estación(es)`, 18 + boxW + 5, y + 13)

  // Box Alto
  doc.setFillColor(254, 226, 226)
  doc.setDrawColor(254, 202, 202)
  doc.roundedRect(14 + (boxW + 5) * 2, y, boxW, 16, 2, 2, 'FD')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(153, 27, 27)
  doc.text('RIESGO ALTO / MUY ALTO', 18 + (boxW + 5) * 2, y + 6)
  doc.setFontSize(12)
  doc.text(`${countAlto} estación(es)`, 18 + (boxW + 5) * 2, y + 13)

  y += 22

  // Análisis de Vulnerabilidad
  const vulnText = `Basado en los niveles de contaminantes detectados en ${countAlto} zonas, se estima un riesgo incrementado para grupos vulnerables (niños y adultos mayores). Se recomienda emitir alertas preventivas a través de los canales digitales.`

  doc.setFillColor(239, 246, 255)
  doc.setDrawColor(191, 219, 254)
  doc.roundedRect(14, y, pageWidth - 28, 16, 2, 2, 'FD')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 64, 175)
  doc.text('Análisis de Vulnerabilidad:', 18, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const splitVuln = doc.splitTextToSize(vulnText, pageWidth - 36)
  doc.text(splitVuln, 18, y + 10)

  y += 22

  // Tabla de Riesgo por Estación
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('Riesgo por Estación / Zona', 14, y)
  y += 6

  const headers = ['Estación / Zona', 'Puntaje', 'Nivel Riesgo', 'Var. Crítica', 'Enfermedad Probable', 'Recomendación']
  const colWidths = [42, 16, 24, 22, 34, 46] // Total: 184 mm

  doc.setFillColor(226, 232, 240)
  doc.rect(14, y, pageWidth - 28, 7, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)

  let curX = 16
  headers.forEach((h, idx) => {
    doc.text(h, curX, y + 5)
    curX += colWidths[idx]
  })
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)

  data.forEach((row, i) => {
    // Calcular altura estimada para el texto de recomendación
    const recText = String(row.conclusion || 'Sin observaciones')
    const splitRec = doc.splitTextToSize(recText, colWidths[5] - 2)
    const rowHeight = Math.max(7, splitRec.length * 3.5 + 3)

    if (y + rowHeight > pageHeight - 15) {
      doc.addPage()
      y = 20
      // Repetir cabecera
      doc.setFillColor(226, 232, 240)
      doc.rect(14, y, pageWidth - 28, 7, 'F')
      doc.setFont('helvetica', 'bold')
      let headerX = 16
      headers.forEach((h, idx) => {
        doc.text(h, headerX, y + 5)
        headerX += colWidths[idx]
      })
      y += 7
      doc.setFont('helvetica', 'normal')
    }

    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(14, y, pageWidth - 28, rowHeight, 'F')
    }

    doc.setTextColor(51, 65, 85)
    let cellX = 16

    const name = String(row.name || '').substring(0, 24)
    const score = String(row.riskScore ?? '—')
    const level = String(row.riskLevel || 'Bajo')
    const crit = String(row.criticalVar || 'Ninguna')
    const disease = String(row.disease || 'Estable')

    doc.setFont('helvetica', 'bold')
    doc.text(name, cellX, y + 4); cellX += colWidths[0]
    doc.setFont('helvetica', 'normal')
    doc.text(score, cellX, y + 4); cellX += colWidths[1]
    
    // Resaltar nivel de riesgo
    if (level === 'Alto' || level === 'Muy Alto') doc.setTextColor(185, 28, 28)
    else if (level === 'Moderado') doc.setTextColor(180, 83, 9)
    else doc.setTextColor(4, 120, 87)

    doc.text(level, cellX, y + 4); cellX += colWidths[2]
    doc.setTextColor(51, 65, 85)

    doc.text(crit, cellX, y + 4); cellX += colWidths[3]
    doc.text(disease, cellX, y + 4); cellX += colWidths[4]
    
    doc.text(splitRec, cellX, y + 4)

    y += rowHeight
  })

  // Pie de página
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addPdfHeaderFooter(doc, 'Riesgo Respiratorio', i, totalPages)
  }

  doc.save(`reporte_riesgo_respiratorio_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. RESPIRATORY RISK — EXCEL EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export function exportRespiratoryRiskExcel({ data = [], filters = {}, orgName = 'Todas' }) {
  const wb = XLSX.utils.book_new()

  const countBajo = data.filter(d => d.riskLevel === 'Bajo').length
  const countMod = data.filter(d => d.riskLevel === 'Moderado').length
  const countAlto = data.filter(d => d.riskLevel === 'Alto').length
  const countMuyAlto = data.filter(d => d.riskLevel === 'Muy Alto').length
  const countIndet = data.filter(d => !d.riskLevel || d.riskLevel === 'Indeterminado').length

  // Hoja 1: Resumen
  const resumenRows = [
    ['REPORTE DE RIESGO RESPIRATORIO'],
    [''],
    ['Fecha de Generación:', new Date().toLocaleString('es-GT')],
    ['Organización:', orgName],
    ['Rango Desde:', formatDate(filters.start)],
    ['Rango Hasta:', formatDate(filters.end)],
    [''],
    ['RESUMEN DE EVALUACIÓN DE RIESGO'],
    ['Total de Estaciones Evaluadas:', data.length],
    ['Estaciones con Riesgo Bajo:', countBajo],
    ['Estaciones con Riesgo Moderado:', countMod],
    ['Estaciones con Riesgo Alto:', countAlto],
    ['Estaciones con Riesgo Muy Alto:', countMuyAlto],
    ['Estaciones con Riesgo Indeterminado:', countIndet],
    [''],
    ['Análisis de Vulnerabilidad:', `Basado en los niveles de contaminantes detectados en ${countAlto + countMuyAlto} zonas, se estima un riesgo incrementado para grupos vulnerables (niños y adultos mayores).`]
  ]

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows)
  wsResumen['!cols'] = [{ wch: 38 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // Hoja 2: Riesgo por Estacion
  const headers = [
    'Device ID',
    'Nombre Estación',
    'Puntaje Riesgo',
    'Nivel Riesgo',
    'Variable Crítica',
    'Enfermedad Probable',
    'Recomendación',
    'Prom. PM2.5 (µg/m³)',
    'Prom. PM10 (µg/m³)',
    'Prom. SO2 (ppb)',
    'Prom. NO2 (ppb)',
    'Prom. CO (ppm)',
    'Prom. CO2 (ppm)',
    'Prom. Humedad (%)',
    'Prom. Temperatura (°C)'
  ]

  const rows = data.map(d => {
    const vars = d.variables || {}
    const getVal = (varKey) => {
      const v = vars[varKey]
      if (v && v.avg !== undefined && v.avg !== null && !isNaN(v.avg)) {
        return parseFloat(parseFloat(v.avg).toFixed(2))
      }
      return '--'
    }

    const pm25 = getVal('pm25')
    const pm10 = getVal('pm10')
    const so2 = getVal('so2')
    const no2 = getVal('no2') || getVal('nox')
    const co = getVal('co')
    const co2 = getVal('co2')
    const hum = getVal('humedad') !== '--' ? getVal('humedad') : getVal('humidity')
    const temp = getVal('temperatura') !== '--' ? getVal('temperatura') : getVal('temperature')

    return [
      d.id,
      d.name,
      d.riskScore ?? '',
      d.riskLevel || 'Bajo',
      d.criticalVar || 'Ninguna',
      d.disease || 'Estable',
      d.conclusion || '',
      pm25,
      pm10,
      so2,
      no2,
      co,
      co2,
      hum,
      temp
    ]
  })

  const wsDetalles = XLSX.utils.aoa_to_sheet([headers, ...rows])
  wsDetalles['!cols'] = [
    { wch: 38 }, // Device ID
    { wch: 30 }, // Nombre Estación
    { wch: 15 }, // Puntaje
    { wch: 15 }, // Nivel
    { wch: 16 }, // Var Crítica
    { wch: 22 }, // Enfermedad
    { wch: 55 }, // Recomendación
    { wch: 18 }, // PM2.5
    { wch: 18 }, // PM10
    { wch: 16 }, // SO2
    { wch: 16 }, // NO2
    { wch: 16 }, // CO
    { wch: 16 }, // CO2
    { wch: 18 }, // Humedad
    { wch: 20 }  // Temp
  ]
  XLSX.utils.book_append_sheet(wb, wsDetalles, 'Riesgo por Estacion')

  XLSX.writeFile(wb, `reporte_riesgo_respiratorio_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
