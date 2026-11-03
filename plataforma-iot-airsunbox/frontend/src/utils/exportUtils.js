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
// Margenes del pie de pagina. PIE es donde se dibuja la linea separadora y
// PIE_ALTO es la franja que el contenido de la ultima pagina no puede pisar.
// Ambos estan centralizados porque un desajuste entre las dos constantes es
// justo lo que hace que la fecha de generacion termine encima de un texto.
const PIE = 12
const PIE_ALTO = PIE + 8

function addPdfHeaderFooter(doc, reportTitle, pageNum, totalPages) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Encabezado
  doc.setFillColor(103, 183, 232) // #67B7E8
  doc.rect(0, 0, pageWidth, 12, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('Plataforma IoT AirSunBox', 14, 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(reportTitle, pageWidth - 14, 8, { align: 'right' })

  // Pie de página
  doc.setDrawColor(220, 220, 220)
  doc.line(14, pageHeight - PIE, pageWidth - 14, pageHeight - PIE)
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(`Generado el ${new Date().toLocaleString('es-GT')}`, 14, pageHeight - PIE + 6)
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - 14, pageHeight - PIE + 6, { align: 'right' })
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
    'Prom. H₂S (µg/m³)',
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
    const h2s = getVal('h2s')
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
      h2s,
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
    { wch: 16 }, // H2S
    { wch: 16 }, // CO
    { wch: 16 }, // CO2
    { wch: 18 }, // Humedad
    { wch: 20 }  // Temp
  ]
  XLSX.utils.book_append_sheet(wb, wsDetalles, 'Riesgo por Estacion')

  XLSX.writeFile(wb, `reporte_riesgo_respiratorio_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTROS POR ESTACIÓN — PDF
// ─────────────────────────────────────────────────────────────────────────────

const UNIT_BY_VARIABLE = {
  temperatura: '°C',
  humedad: '% HR',
  co: 'ppm',
  co2: 'ppm',
  nh3: 'ppm',
  h2s: 'µg/m³',
  nox: 'ppb',
  o3: 'ppb',
  pm1: 'µg/m³',
  pm10: 'µg/m³',
  pm25: 'µg/m³',
  so2: 'ppb'
}

const LABEL_BY_VARIABLE = {
  temperatura: 'Temperatura',
  humedad: 'Humedad relativa',
  co: 'Monóxido de carbono',
  co2: 'Dióxido de carbono',
  nh3: 'Amoníaco',
  h2s: 'Sulfuro de hidrógeno',
  nox: 'Óxidos de nitrógeno',
  o3: 'Ozono',
  pm1: 'Partículas < 1 µm',
  pm10: 'Partículas < 10 µm',
  pm25: 'Partículas < 2.5 µm',
  so2: 'Dióxido de azufre'
}

const CATEGORY_COLORS = {
  Excelente: [22, 101, 52],
  Buena: [5, 150, 105],
  'Precaución': [202, 138, 4],
  Moderada: [202, 138, 4],
  Mala: [220, 38, 38],
  'Muy Mala': [190, 18, 60],
  Peligrosa: [190, 18, 60],
  Severa: [136, 19, 55]
}

// Nota metodologica del resumen semanal.
//
// Va como constante y no en linea porque el ancho de la nota depende de la
// lista de sensores: al medirla para decidir el salto de pagina hay que
// tener el mismo texto que despues se dibuja, o la medicion miente.
const NOTA_METODOLOGICA =
  'Las lecturas de gases multigas (H₂S, NOx, CO, O₃, SO₂, NH₃) provienen de los sensores MQ-135, MQ-136, ' +
  'MQ-131 y MQ-7, que no son selectivos: responden de forma cruzada a varios gases y su salida no está ' +
  'calibrada contra un patrón de referencia. Sus valores se presentan como tendencia relativa y como base ' +
  'para comparar horarios y días entre sí, no como concentración absoluta. Se expresan en ppb, salvo el H₂S ' +
  'que se reporta en µg/m³, de acuerdo con la unidad registrada en el catálogo de variables. Para valores ' +
  'regulados se requiere un equipo de referencia. Temperatura, humedad y partículas proceden de sensores ' +
  'dedicados y pueden compararse con instrumentos de referencia.';
/**
 * Dibuja una rejilla de tabla.
 *
 * Se separa del codigo en linea porque el PDF repite el mismo patron en el
 * indice de variables y en el detalle, y las dos tenian las guias verticales
 * ausentes por separado.
 *
 * @param {jsPDF}  doc
 * @param {object} o
 * @param {number[]} o.cols     anchos en mm
 * @param {number}   o.x        borde izquierdo
 * @param {number}   o.y        borde superior (se devuelve actualizado)
 * @param {string[]} o.headers  etiquetas; null para no dibujar cabecera
 * @param {string}   o.headerFill
 * @param {Array}    o.rows      celdas ya formateadas
 * @param {string[]} o.align     'l' | 'r' por columna
 * @param {number}   o.rowH
 */
function drawGrid(doc, o) {
  const { cols, x, headers, headerFill, rows, align, rowH } = o
  const w = cols.reduce((a, b) => a + b, 0)
  let y = o.y

  if (headers && headers.length) {
    doc.setFillColor(headerFill[0], headerFill[1], headerFill[2])
    doc.rect(x, y, w, 6.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    let hx = x
    headers.forEach((h, i) => {
      const a = align?.[i] === 'r' ? 'right' : 'left'
      doc.text(String(h), a === 'right' ? hx + cols[i] - 2.5 : hx + 2.5, y + 4.3, { align: a })
      hx += cols[i]
    })
    y += 6.5
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  rows.forEach((cells, r) => {
    if (r % 2 === 1) {
      doc.setFillColor(249, 250, 251)
      doc.rect(x, y, w, rowH, 'F')
    }
    let cx = x
    cells.forEach((cell, ci) => {
      const spec = cell && typeof cell === 'object' ? cell : { text: cell }
      const a = spec.align || align?.[ci] === 'r' ? 'right' : 'left'
      if (spec.color) {
        doc.setTextColor(spec.color[0], spec.color[1], spec.color[2])
        doc.setFont('helvetica', spec.bold === false ? 'normal' : 'bold')
      } else {
        doc.setTextColor(55, 65, 81)
        doc.setFont('helvetica', 'normal')
      }
      const tx = a === 'right' ? cx + cols[ci] - 2.5 : cx + 2.5
      doc.text(String(spec.text ?? '—'), tx, y + rowH * 0.7, { align: a })
      cx += cols[ci]
    })
    y += rowH
  })

  // Guias verticales: una por separacion de columna, del ancho completo de la
  // tabla. Son las que separan un dato del siguiente.
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.15)
  let gx = x
  for (let i = 0; i < cols.length - 1; i++) {
    gx += cols[i]
    doc.line(gx, o.y + (headers && headers.length ? 6.5 : 0), gx, y)
  }
  // Marco exterior superior e inferior: cierran el bloque.
  doc.line(x, o.y, x + w, o.y)
  doc.line(x, y, x + w, y)

  doc.setFont('helvetica', 'normal')
  return y
}

function formatTimestamp(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function humanDuration(hours) {
  if (hours === null || hours === undefined) return '—'
  if (hours < 1) return `${Math.round(hours * 60)} minutos`
  if (hours < 48) return `${Number(hours.toFixed(2))} horas`
  return `${Number((hours / 24).toFixed(2))} días`
}

function slugify(text) {
  return String(text || 'estacion')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

export function exportStationRecordsPDF(payload = {}) {
  const { device = {}, period = {}, coverage = {}, variables = [] } = payload
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const left = 14
  const usable = pageWidth - left * 2

  // ── Portada de identificación ──
  doc.setFillColor(103, 183, 232)
  doc.rect(0, 0, pageWidth, 34, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('Registros de Medición', left, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(device.name || 'Estación sin nombre', left, 21)
  doc.setFontSize(8)
  doc.text('Plataforma IoT AirSunBox', left, 27)

  // ── Datos de la estación (lugar) ──
  doc.setTextColor(30, 41, 59)
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(left, 40, usable, 42, 2, 2, 'FD')
  doc.setFontSize(9)

  const coords =
    device.lat !== null && device.lat !== undefined && device.lng !== null && device.lng !== undefined
      ? `${Number(device.lat).toFixed(6)}, ${Number(device.lng).toFixed(6)}`
      : 'Sin coordenadas'

  const identidad = [
    ['Estación', device.name || '—'],
    ['Serial', device.serial || '—'],
    ['Espacio / Zona', device.space_name || '—'],
    ['Coordenadas', coords]
  ]
  identidad.forEach(([k, v], i) => {
    const y = 47 + i * 5
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.text(`${k}:`, left + 3, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(17, 24, 39)
    doc.text(String(v), left + 42, y)
  })

  // ── Datos del período (fecha y duración) ──
  const periodo = [
    ['Desde', formatTimestamp(period.start)],
    ['Hasta', formatTimestamp(period.end)],
    ['Duración', humanDuration(period.durationHours)],
    ['Lecturas', `${coverage.totalReadings ?? 0} en total · ${variables.length} variables`]
  ]
  periodo.forEach(([k, v], i) => {
    const y = 47 + i * 5
    const x = left + usable / 2 + 4
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.text(`${k}:`, x, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(17, 24, 39)
    doc.text(String(v), x + 30, y)
  })

  let y = 88

  // ── Aviso de truncamiento ──
  if (coverage.truncated) {
    doc.setFillColor(254, 243, 199)
    doc.setDrawColor(252, 211, 77)
    doc.roundedRect(left, y, usable, 12, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(120, 53, 15)
    doc.text(
      `Documento recortado: se incluyen hasta ${coverage.limitPerVariable} lecturas por variable.`,
      left + 3, y + 4.5
    )
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Para el volcado completo (${coverage.totalReadings} lecturas) exporte a Excel.`,
      left + 3, y + 9
    )
    y += 18
  }

  // ── Índice de variables ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(30, 41, 59)
  doc.text('Resumen por variable', left, y)
  y += 6

  const idxHeaders = ['Variable', 'Unidad', 'Lecturas', 'Mínimo', 'Promedio', 'Máximo', 'No incl.']
  const idxWidths = [42, 18, 19, 23, 24, 23, 20]
  const idxTotal = idxWidths.reduce((a, b) => a + b, 0)
  const idxScale = usable / idxTotal
  const idxCols = idxWidths.map(w => w * idxScale)
  // Variable y Unidad son texto; el resto, numeros. Alineados a la derecha, los
  // decimales de Minimo/Promedio/Maximo caen en la misma columna vertical y se
  // comparan de un vistazo.
  const idxAlign = ['l', 'l', 'r', 'r', 'r', 'r', 'r']

  y = drawGrid(doc, {
    cols: idxCols, x: left, y,
    headers: idxHeaders, align: idxAlign, rowH: 6,
    headerFill: [226, 232, 240],
    rows: variables.map(v => {
      const omitted = v.total - v.readings.length
      const num = x => ({ text: x === null ? '—' : Number(x).toFixed(2), align: 'r' })
      return [
        LABEL_BY_VARIABLE[v.variable] || v.variable,
        UNIT_BY_VARIABLE[v.variable] || '',
        { text: String(v.total), align: 'r' },
        num(v.min),
        num(v.avg),
        num(v.max),
        omitted > 0
          ? { text: `+${omitted}`, align: 'r', color: [180, 83, 9] }
          : { text: '—', align: 'r' }
      ]
    })
  })

  // ── Detalle por variable ──
  for (const v of variables) {
    if (!v.readings.length) continue
    y += 8
    if (y > pageHeight - 30) {
      // el encabezado y pie definitivos los aplica el loop final sobre todas las páginas
      doc.addPage()
      y = 20
    }

    const unit = UNIT_BY_VARIABLE[v.variable] || ''
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30, 41, 59)
    doc.text(LABEL_BY_VARIABLE[v.variable] || v.variable, left, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    const sufijo = v.truncated ? ` — ${v.readings.length} de ${v.total} lecturas` : ` — ${v.readings.length} lecturas`
    doc.text(`${unit} ${sufijo}`, pageWidth - left, y, { align: 'right' })
    y += 5

    // La unidad se queda en la cabecera de la variable, no repetida en cada
    // fila: 60 filas con "ppb" al lado del 27.60 es ruido que empuja el dato
    // fuera del centro de la columna.
    const headers = ['Fecha y hora', 'Valor', 'Categoría', 'Puntaje']
    const widths = [52, 26, 56, 22]
    const tScale = usable / widths.reduce((a, b) => a + b, 0)
    const cols = widths.map(w => w * tScale)
    const align = ['l', 'r', 'l', 'r']
    const rowH = 5.6

    const drawHead = () => {
      y = drawGrid(doc, {
        cols, x: left, y, headers, align, rowH,
        headerFill: [51, 65, 85],
        rows: []
      })
    }
    drawHead()

    v.readings.forEach(r => {
      if (y > pageHeight - PIE_ALTO) {
        doc.addPage()
        y = 20
        drawHead()
      }
      const cat = r.category && CATEGORY_COLORS[r.category]
      y = drawGrid(doc, {
        cols, x: left, y, align, rowH,
        rows: [[
          formatTimestamp(r.time),
          { text: Number(r.value).toFixed(2), align: 'r' },
          cat ? { text: r.category, color: cat } : (r.category || '—'),
          { text: r.score ?? '—', align: 'r' }
        ]]
      })
    })
  }

  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    addPdfHeaderFooter(doc, 'Registros de Medición', p, total)
  }

  doc.save(`registros_${slugify(device.name)}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTROS POR ESTACIÓN — EXCEL (volcado completo)
// ─────────────────────────────────────────────────────────────────────────────

export function exportStationRecordsExcel(payload = {}) {
  const { device = {}, period = {}, coverage = {}, variables = [] } = payload
  const wb = XLSX.utils.book_new()

  const resumen = [
    ['REGISTRO DE MEDICIONES POR ESTACIÓN'],
    [],
    ['Estación', device.name || '—'],
    ['Serial', device.serial || '—'],
    ['Espacio / Zona', device.space_name || '—'],
    [
      'Coordenadas',
      device.lat !== null && device.lat !== undefined && device.lng !== null && device.lng !== undefined
        ? `${Number(device.lat).toFixed(6)}, ${Number(device.lng).toFixed(6)}`
        : 'Sin coordenadas'
    ],
    [],
    ['Desde', formatTimestamp(period.start)],
    ['Hasta', formatTimestamp(period.end)],
    ['Duración', humanDuration(period.durationHours)],
    ['Lecturas totales', coverage.totalReadings ?? 0],
    ['Variables', variables.length],
    [],
    ['Nota', 'Volcado completo: incluye todas las lecturas del rango, sin recorte.']
  ]
  const wsResumen = XLSX.utils.aoa_to_sheet(resumen)
  wsResumen['!cols'] = [{ wch: 22 }, { wch: 62 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Estación')

  const estadisticas = [['Variable', 'Unidad', 'Lecturas', 'Mínimo', 'Promedio', 'Máximo']]
  variables.forEach(v => {
    estadisticas.push([
      LABEL_BY_VARIABLE[v.variable] || v.variable,
      UNIT_BY_VARIABLE[v.variable] || '',
      v.total,
      v.min === null ? '—' : Number(v.min).toFixed(2),
      v.avg === null ? '—' : Number(v.avg).toFixed(2),
      v.max === null ? '—' : Number(v.max).toFixed(2)
    ])
  })
  const wsStats = XLSX.utils.aoa_to_sheet(estadisticas)
  wsStats['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsStats, 'Resumen')

  // Una hoja por variable: el volcado íntegro, sin el tope del PDF
  variables.forEach(v => {
    if (!v.readings.length) return
    const rows = [['Fecha y hora', 'Valor', 'Unidad', 'Categoría', 'Puntaje']]
    v.readings.forEach(r => {
      rows.push([
        formatTimestamp(r.time),
        Number(r.value).toFixed(2),
        UNIT_BY_VARIABLE[v.variable] || '',
        r.category || '',
        r.score ?? ''
      ])
    })
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 10 }]
    const sheetName = (LABEL_BY_VARIABLE[v.variable] || v.variable).slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  })

  XLSX.writeFile(wb, `registros_${slugify(device.name)}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ─────────────────────────────────────────────────────────────────────────────
// RESUMEN SEMANAL POR ESTACIÓN — PDF (horizontal)
// ─────────────────────────────────────────────────────────────────────────────

function weekLabel(iso) {
  const d = new Date(`${iso}T00:00:00`)
  if (isNaN(d.getTime())) return iso
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}`
}

export function exportStationWeeklyPDF(payload = {}) {
  const { device = {}, period = {}, weeks = [], variables = [], coverage } = payload
  // horizontal: 12 variables necesitan el ancho completo
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const left = 12
  const usable = pageWidth - left * 2

  // El rango pedido no siempre coincide con lo que hay almacenado: se pide un
  // mes y solo hay 2 semanas de datos. Se anuncia la cobertura real para que el
  // encabezado no prometa periodos que el reporte no contiene.
  const cov = coverage || {}
  const coverageHours = cov.first && cov.last
    ? (new Date(cov.last).getTime() - new Date(cov.first).getTime()) / 3600000
    : 0
  const coversRequested =
    !!cov.first && !!cov.last &&
    new Date(cov.first).getTime() >= new Date(period.start).getTime() - 3600000 &&
    new Date(cov.last).getTime() <= new Date(period.end).getTime() + 3600000

  const rangeText = cov.first && cov.last
    ? `${formatTimestamp(cov.first)} a ${formatTimestamp(cov.last)}`
    : '—'
  const spanText = coversRequested ? period.durationHours : coverageHours

  doc.setFillColor(103, 183, 232)
  doc.rect(0, 0, pageWidth, 26, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text('Resumen Semanal de Mediciones', left, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`${device.name || 'Estación'} — ${rangeText} (${humanDuration(spanText)})`, left, 19)

  const totalReadings = variables.reduce((a, v) => a + v.count, 0)
  const coords =
    device.lat !== null && device.lat !== undefined && device.lng !== null && device.lng !== undefined
      ? `${Number(device.lat).toFixed(6)}, ${Number(device.lng).toFixed(6)}`
      : 'Sin coordenadas'

  // ── Matriz: filas = semanas, columnas = variables ──
  const weekCol = 24
  const varWidth = (usable - weekCol) / Math.max(variables.length, 1)

  let y = 34
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(
    `Promedio semanal de ${variables.length} variables · ${weeks.length} semana(s) · ${totalReadings.toLocaleString()} lecturas`,
    left, y
  )
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`Espacio: ${device.space_name || '—'}   Coordenadas: ${coords}`, left, y + 5)
  y += 5
  if (!coversRequested && period.start && period.end) {
    doc.setTextColor(180, 83, 9)
    doc.text(
      `Rango solicitado: ${formatTimestamp(period.start)} a ${formatTimestamp(period.end)}. ` +
      `El reporte incluye solo las semanas con lecturas registradas.`,
      left, y + 5
    )
    y += 5
  }
  y += 8

  const drawHeader = () => {
    doc.setFillColor(51, 65, 85)
    doc.rect(left, y, usable, 12, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(255, 255, 255)
    doc.text('Semana', left + 2, y + 8)
    variables.forEach((v, i) => {
      const unit = UNIT_BY_VARIABLE[v.variable] || ''
      doc.text((LABEL_BY_VARIABLE[v.variable] || v.variable), left + weekCol + i * varWidth + 1.5, y + 5.5, {
        align: 'center',
        maxWidth: varWidth - 3
      })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(203, 213, 225)
      doc.text(unit, left + weekCol + i * varWidth + 1.5, y + 10, { align: 'center' })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(255, 255, 255)
    })
    y += 12
  }
  drawHeader()

  weeks.forEach((week, wi) => {
    if (y > pageHeight - 20) {
      addPdfHeaderFooter(doc, 'Resumen Semanal', doc.getNumberOfPages(), doc.getNumberOfPages())
      doc.addPage()
      y = 16
      drawHeader()
    }
    if (wi % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(left, y, usable, 7, 'F')
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(30, 41, 59)
    doc.text(weekLabel(week), left + 2, y + 4.8)
    variables.forEach((v, i) => {
      const value = v.byWeek[week]
      if (value === undefined || value === null) {
        doc.setTextColor(203, 213, 225)
        doc.text('—', left + weekCol + i * varWidth + varWidth / 2, y + 4.8, { align: 'center' })
        return
      }
      // color por banda de calidad del promedio semanal
      const band = (v.ranges || []).find(r => r.min <= value && (r.max === null || r.max > value))
      if (band && CATEGORY_COLORS[band.category]) {
        const [rr, gg, bb] = CATEGORY_COLORS[band.category]
        doc.setTextColor(rr, gg, bb)
        doc.setFont('helvetica', 'bold')
      } else {
        doc.setTextColor(55, 65, 81)
        doc.setFont('helvetica', 'normal')
      }
      doc.text(Number(value).toFixed(2), left + weekCol + i * varWidth + varWidth / 2, y + 4.8, { align: 'center' })
    })
    doc.setFont('helvetica', 'normal')
    y += 7
  })

  // ── Fila de promedio general ──
  if (y > pageHeight - 24) {
    addPdfHeaderFooter(doc, 'Resumen Semanal', doc.getNumberOfPages(), doc.getNumberOfPages())
    doc.addPage()
    y = 16
  }
  y += 2
  doc.setFillColor(226, 232, 240)
  doc.rect(left, y, usable, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(17, 24, 39)
  doc.text('Promedio', left + 2, y + 5.4)
  variables.forEach((v, i) => {
    doc.setTextColor(55, 65, 81)
    doc.text(v.avg === null ? '—' : Number(v.avg).toFixed(2), left + weekCol + i * varWidth + varWidth / 2, y + 5.4, { align: 'center' })
  })
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  doc.text('Lecturas del periodo por variable', left, y)
  y += 5

  const statsHeaders = ['Variable', 'Unidad', 'Mínimo', 'Promedio', 'Máximo', 'Semanas']
  const statsWidths = [46, 18, 24, 26, 24, 20]
  const sScale = usable / statsWidths.reduce((a, b) => a + b, 0)
  const statsCols = statsWidths.map(w => w * sScale)

  doc.setFillColor(226, 232, 240)
  doc.rect(left, y, usable, 6.5, 'F')
  doc.setFontSize(7)
  doc.setTextColor(30, 41, 59)
  let sx = left + 2
  statsHeaders.forEach((h, i) => {
    doc.text(h, sx, y + 4.4)
    sx += statsCols[i]
  })
  y += 6.5

  variables.forEach((v, i) => {
    if (y > pageHeight - PIE_ALTO) {
      doc.addPage()
      y = 16
    }
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(left, y, usable, 5.6, 'F')
    }
    const cells = [
      LABEL_BY_VARIABLE[v.variable] || v.variable,
      UNIT_BY_VARIABLE[v.variable] || '',
      v.min === null ? '—' : Number(v.min).toFixed(2),
      v.avg === null ? '—' : Number(v.avg).toFixed(2),
      v.max === null ? '—' : Number(v.max).toFixed(2),
      String(Object.keys(v.byWeek).length)
    ]
    let cx = left + 2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    cells.forEach((cell, ci) => {
      doc.setTextColor(55, 65, 81)
      doc.text(cell, cx, y + 3.9)
      cx += statsCols[ci]
    })
    y += 5.6
  })

  // Nota metodologica: los sensores multigas no son seletivos. Sin esto el
  // lector toma las concentraciones como una medicion calibrada.
  //
  // La nota se mide ANTES de dibujar para decidir el salto de pagina. El margen
  // fijo anterior se quedaba corto en cuanto la nota crecio al listar mas
  // sensores, y entonces invadia la franja del pie, donde vive la fecha de
  // generacion. Medir el bloque real evita adivinar el alto.
  const NOTA_FONT = 7
  const NOTA_LH = NOTA_FONT * 0.352777 * 1.25
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(NOTA_FONT)
  const notaLineas = doc.splitTextToSize(NOTA_METODOLOGICA, usable - 4)
  // +3 separador, +4 titulo, +4 primera linea, +2 descendente de la ultima.
  const notaAlto = 3 + 4 + 4 + (notaLineas.length - 1) * NOTA_LH + 2

  if (y + notaAlto > pageHeight - PIE_ALTO) {
    // Dibujar el pie en la página actual ANTES de saltar para no perderlo
    addPdfHeaderFooter(doc, 'Resumen Semanal', doc.getNumberOfPages(), doc.getNumberOfPages()) 
    doc.addPage()
    y = 16
  }
  y += 3
  doc.setDrawColor(203, 213, 225)
  doc.line(left, y, left + usable, y)
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(NOTA_FONT)
  doc.setTextColor(71, 85, 105)
  doc.text('Nota metodológica', left, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(notaLineas, left, y, { lineHeightFactor: 1.25 })

  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    addPdfHeaderFooter(doc, 'Resumen Semanal', p, total)
  }

  doc.save(`resumen_semanal_${slugify(device.name)}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTE DE ESPACIO (organizaciones independientes)
// Se arma con las variables y niveles que definió el propio espacio.
// ─────────────────────────────────────────────────────────────────────────────
const hexToRgb = (hex) => {
  const h = String(hex || '#67B7E8').replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const fmtNum = (v, d = 1) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(Math.abs(v) >= 100 ? 0 : d))
const levelName = (v, idx) => (idx != null && v.levels ? v.levels[idx]?.name : '')
const dayStr = (d) => { const [y, m, dd] = String(d).slice(0, 10).split('-'); return dd ? `${dd}/${m}/${y}` : String(d) }
const whenStr = (t) => (t ? new Date(t).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const pctStr = (x) => `${Math.round((x || 0) * 100)} %`
const INC_STATUS = { open: 'Abierta', in_review: 'En atención', resolved: 'Resuelta' }
const ALERT_STATUS = { sent: 'Enviado', partial: 'Envío parcial', failed: 'No se pudo enviar' }
const capFirst = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1)
const safeName = (s) => String(s || 'espacio').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')

export function exportSpaceReportPDF(report) {
  const { space = {}, period = {}, variables = [], devices = [], stations = [], summary = {}, alerts = { total: 0, items: [] }, incidents = { total: 0, items: [] }, deviceId } = report || {}
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const left = 14
  const usable = pageWidth - left * 2
  const title = `Reporte del espacio ${space.name || ''}`
  let y = 22

  const ensure = (h) => {
    if (y + h > pageHeight - PIE_ALTO) { doc.addPage(); y = 22 }
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(30, 41, 59)
  doc.text(title, left, y); y += 7
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100, 116, 139)
  const total = variables.reduce((a, v) => a + (v.stats?.count || 0), 0)
  const scope = deviceId ? `Estación: ${stations[0]?.name || ''}` : `${devices.length} estación(es)`
  doc.text(`Periodo: ${formatDate(period.start)} al ${formatDate(period.end)} · ${scope} · ${total.toLocaleString('es-GT')} lecturas`, left, y)
  y += 5.5
  doc.text(`Cobertura de datos: ${pctStr(summary.coverage)} · Última lectura: ${whenStr(summary.last)} · Alertas: ${alerts.total} · Incidencias: ${incidents.total}`, left, y)
  y += 10

  for (const v of variables) {
    ensure(46)
    doc.setDrawColor(226, 232, 240); doc.line(left, y - 4, left + usable, y - 4)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30, 41, 59)
    doc.text(`${capFirst(v.name)}${v.unit ? ` (${v.unit})` : ''}`, left, y + 2)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 116, 139)
    doc.text(`Clave: ${v.station_key}`, left + usable, y + 2, { align: 'right' })
    y += 9

    if (!v.stats?.count) {
      doc.text('Sin lecturas en el periodo.', left, y); y += 10
      continue
    }
    doc.setTextColor(30, 41, 59); doc.setFontSize(10)
    const lv = levelName(v, v.level)
    doc.text(`Promedio ${fmtNum(v.stats.avg)}${lv ? ` (${lv})` : ''}   ·   Mínimo ${fmtNum(v.stats.min)}   ·   Máximo ${fmtNum(v.stats.max)}   ·   ${v.stats.count.toLocaleString('es-GT')} lecturas`, left, y)
    y += 5
    if (v.peak) {
      doc.setFontSize(9); doc.setTextColor(100, 116, 139)
      doc.text(`Máximo registrado: ${fmtNum(v.peak.value)} el ${whenStr(v.peak.time)}${v.peak.device ? ` en ${v.peak.device}` : ''}`, left, y)
      y += 2
    }
    y += 5

    // Horas en cada nivel: barra apilada + leyenda
    if (v.levels && v.totalHours) {
      let x = left
      v.levels.forEach((l, i) => {
        const w = (v.hoursByLevel[i] / v.totalHours) * usable
        if (w <= 0) return
        doc.setFillColor(...hexToRgb(l.color))
        doc.rect(x, y, Math.max(w - 0.5, 0.3), 4, 'F')
        x += w
      })
      y += 8
      doc.setFontSize(8.5)
      let lx = left
      v.levels.forEach((l, i) => {
        const txt = `${l.name}: ${v.hoursByLevel[i]} h (${Math.round((v.hoursByLevel[i] / v.totalHours) * 100)} %)`
        const tw = doc.getTextWidth(txt) + 8
        if (lx + tw > left + usable) { lx = left; y += 5 }
        doc.setFillColor(...hexToRgb(l.color)); doc.rect(lx, y - 2.6, 2.6, 2.6, 'F')
        doc.setTextColor(51, 65, 85); doc.text(txt, lx + 4, y)
        lx += tw
      })
      y += 8
    }

    // Promedios diarios
    if (v.daily?.length) {
      ensure(14)   // la tabla arranca junto a su variable y se corta por filas
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(100, 116, 139)
      const cols = [left, left + 40, left + 75, left + 110]
      ;['Día', 'Promedio', 'Mínimo', 'Máximo'].forEach((h, i) => doc.text(h, cols[i], y))
      y += 4.5
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59)
      for (const d of v.daily) {
        ensure(5)
        doc.text(dayStr(d.day), cols[0], y)
        doc.text(fmtNum(d.avg), cols[1], y)
        doc.text(fmtNum(d.min), cols[2], y)
        doc.text(fmtNum(d.max), cols[3], y)
        y += 4.5
      }
      y += 6
    }
  }

  // Promedio por estación
  if (devices.length > 1) {
    ensure(20)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30, 41, 59)
    doc.text('Promedio por estación', left, y); y += 7
    const colW = (usable - 50) / Math.max(variables.length, 1)
    doc.setFontSize(8); doc.setTextColor(100, 116, 139)
    doc.text('Estación', left, y)
    variables.forEach((v, i) => doc.text(doc.splitTextToSize(v.name, colW - 2)[0], left + 50 + i * colW, y))
    y += 5
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59)
    for (const d of devices) {
      ensure(5)
      doc.text(doc.splitTextToSize(d.name, 48)[0], left, y)
      variables.forEach((v, i) => {
        const r = v.byDevice.find(x => x.id === d.id)
        doc.text(r ? fmtNum(r.avg) : '—', left + 50 + i * colW, y)
      })
      y += 5
    }
  }

  const sectionTitle = (t) => {
    ensure(16)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30, 41, 59)
    doc.text(t, left, y); y += 7
  }
  const row = (cells, xs, bold = false) => {
    ensure(5)
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(8.5)
    doc.setTextColor(...(bold ? [100, 116, 139] : [30, 41, 59]))
    cells.forEach((c, i) => doc.text(doc.splitTextToSize(String(c ?? '—'), (xs[i + 1] ?? left + usable) - xs[i] - 2)[0], xs[i], y))
    y += 5
  }

  y += 4
  sectionTitle('Estado de las estaciones')
  const sx = [left, left + 70, left + 100, left + 130]
  row(['Estación', 'Cobertura', 'Lecturas', 'Última lectura'], sx, true)
  stations.forEach(st => row([st.name, pctStr(st.coverage), st.readings.toLocaleString('es-GT'), whenStr(st.last)], sx))

  y += 4
  sectionTitle(`Alertas disparadas (${alerts.total})`)
  if (!alerts.total) row(['No se disparó ninguna alerta en el periodo.'], [left])
  else {
    const ax = [left, left + 32, left + 75, left + 112, left + 132, left + 160]
    row(['Fecha', 'Estación', 'Variable', 'Valor', 'Nivel', 'Canal'], ax, true)
    alerts.items.forEach(a => row([whenStr(a.time), a.device, capFirst(a.variable), fmtNum(a.value), a.category || '—', capFirst(a.channel || '—')], ax))
  }

  y += 4
  sectionTitle(`Incidencias (${incidents.total})`)
  if (!incidents.total) row(['No se reportaron incidencias en el periodo.'], [left])
  else {
    const ix = [left, left + 32, left + 70, left + 95]
    row(['Fecha', 'Estación', 'Estado', 'Problema'], ix, true)
    incidents.items.forEach(i => row([whenStr(i.time), i.device, INC_STATUS[i.status] || i.status, i.reason], ix))
  }

  const pages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    addPdfHeaderFooter(doc, title, p, pages)
  }
  doc.save(`Reporte_${safeName(space.name + (deviceId ? ` ${stations[0]?.name || ""}` : ""))}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

export function exportSpaceReportExcel(report) {
  const { space = {}, period = {}, variables = [], devices = [], stations = [], summary = {}, alerts = { total: 0, items: [] }, incidents = { total: 0, items: [] }, deviceId } = report || {}
  const wb = XLSX.utils.book_new()

  const resumen = [
    ['Reporte del espacio', space.name || ''],
    ['Periodo', `${formatDate(period.start)} al ${formatDate(period.end)}`],
    [deviceId ? 'Estación' : 'Estaciones', deviceId ? (stations[0]?.name || '') : devices.length],
    ['Cobertura de datos', pctStr(summary.coverage)],
    ['Última lectura', whenStr(summary.last)],
    ['Alertas disparadas', alerts.total],
    ['Incidencias', incidents.total],
    [],
    ['Variable', 'Clave', 'Unidad', 'Promedio', 'Nivel del promedio', 'Mínimo', 'Máximo', 'Máximo registrado el', 'Máximo en estación', 'Lecturas', 'Horas con datos',
      ...((variables.find(v => v.levels)?.levels || []).map(l => `Horas en ${l.name}`))]
  ]
  for (const v of variables) {
    resumen.push([
      v.name, v.station_key, v.unit || '',
      v.stats?.avg != null ? Number(Number(v.stats.avg).toFixed(2)) : '',
      levelName(v, v.level),
      v.stats?.min ?? '', v.stats?.max ?? '', v.peak ? whenStr(v.peak.time) : '', v.peak?.device || '', v.stats?.count || 0, v.totalHours || 0,
      ...(v.hoursByLevel || [])
    ])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), 'Resumen')

  const diario = [['Variable', 'Día', 'Promedio', 'Mínimo', 'Máximo']]
  for (const v of variables) for (const d of v.daily || []) {
    diario.push([v.name, dayStr(d.day), d.avg != null ? Number(d.avg.toFixed(2)) : '', d.min, d.max])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(diario), 'Diario')

  const est = [['Estación', 'Variable', 'Promedio', 'Nivel', 'Mínimo', 'Máximo', 'Lecturas']]
  for (const v of variables) for (const r of v.byDevice || []) {
    est.push([r.name, v.name, Number(r.avg.toFixed(2)), levelName(v, r.level), r.min, r.max, r.count])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(est), 'Por estación')

  const hora = [['Hora', ...variables.map(v => `${v.name}${v.unit ? ` (${v.unit})` : ''}`)]]
  for (let h = 0; h < 24; h++) {
    hora.push([`${String(h).padStart(2, '0')}:00`, ...variables.map(v => (v.byHour?.[h] != null ? Number(v.byHour[h].toFixed(2)) : ''))])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hora), 'Por hora del día')

  const cov = [['Estación', 'Cobertura de datos', 'Horas con datos', 'Lecturas', 'Última lectura']]
  for (const st of stations) cov.push([st.name, pctStr(st.coverage), st.hours, st.readings, whenStr(st.last)])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cov), 'Estado de estaciones')

  const al = [['Fecha', 'Estación', 'Variable', 'Valor', 'Nivel', 'Canal', 'Estado']]
  for (const a of alerts.items) al.push([whenStr(a.time), a.device, a.variable, a.value, a.category || '', a.channel || '', ALERT_STATUS[a.status] || a.status])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(al), 'Alertas')

  const inc = [['Fecha', 'Estación', 'Estado', 'Problema', 'Resuelta', 'Respuesta']]
  for (const i of incidents.items) inc.push([whenStr(i.time), i.device, INC_STATUS[i.status] || i.status, i.reason, whenStr(i.resolved_at), i.notes || ''])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(inc), 'Incidencias')

  XLSX.writeFile(wb, `Reporte_${safeName(space.name + (deviceId ? ` ${stations[0]?.name || ""}` : ""))}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
