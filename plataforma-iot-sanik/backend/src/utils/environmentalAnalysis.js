export function analyzeEnvironmentalImpact(devicesData) {
  const levels = {
    LOW: { label: 'Baja contaminación', color: '#10b981', score: 1 },
    MODERATE: { label: 'Contaminación moderada', color: '#f59e0b', score: 2 },
    HIGH: { label: 'Alta contaminación', color: '#ef4444', score: 3 },
    CRITICAL: { label: 'Contaminación crítica', color: '#7c3aed', score: 4 }
  };

  const pollutantInfo = {
    pm25: { name: 'PM2.5', group: 'particulate', thresholds: [12, 35, 150], unit: 'µg/m³', desc: 'Partículas finas de menos de 2.5 micras.' },
    pm10: { name: 'PM10', group: 'particulate', thresholds: [54, 154, 250], unit: 'µg/m³', desc: 'Partículas sólidas de polvo, cenizas o hollín.' },
    co: { name: 'CO', group: 'gaseous', thresholds: [4, 9, 15], unit: 'mg/m³', desc: 'Monóxido de Carbono de combustiones incompletas.' },
    o3: { name: 'O₃', group: 'gaseous', thresholds: [50, 70, 100], unit: 'ppb', desc: 'Ozono Troposférico formado por reacciones fotoquímicas.' },
    so2: { name: 'SO₂', group: 'gaseous', thresholds: [35, 75, 185], unit: 'ppb', desc: 'Dióxido de Azufre de quema de combustibles fósiles.' },
    nox: { name: 'NOX', group: 'gaseous', thresholds: [40, 100, 200], unit: 'ppb', desc: 'Óxidos de Nitrógeno de alta temperatura.' },
    h2s: { name: 'H₂S', group: 'gaseous', thresholds: [1, 5, 10], unit: 'ppb', desc: 'Sulfuro de Hidrógeno (olor a huevo podrido).' }
  };

  return Object.values(devicesData).map(dev => {
    const vars = dev.variables;
    const individualAnalyses = [];
    let particulateScore = 0;
    let gaseousScore = 0;

    // 1. Analizar factores individuales
    Object.keys(pollutantInfo).forEach(pKey => {
      const data = vars[pKey];
      if (data) {
        const val = data.avg;
        const info = pollutantInfo[pKey];
        let score = 1;
        let influence = 'Impacto bajo';

        if (val > info.thresholds[2]) { score = 4; influence = 'Crítico'; }
        else if (val > info.thresholds[1]) { score = 3; influence = 'Alto'; }
        else if (val > info.thresholds[0]) { score = 2; influence = 'Moderado'; }

        if (info.group === 'particulate') particulateScore = Math.max(particulateScore, score);
        else gaseousScore = Math.max(gaseousScore, score);

        individualAnalyses.push({
          key: pKey,
          name: info.name,
          value: val.toFixed(1),
          unit: info.unit,
          score,
          influence,
          deviation: (val / info.thresholds[0]).toFixed(1) + 'x nivel normal'
        });
      }
    });

    // Ordenar por influencia
    individualAnalyses.sort((a, b) => b.score - a.score || parseFloat(b.deviation) - parseFloat(a.deviation));

    // 2. Clasificación Global
    const maxScore = individualAnalyses.length > 0 ? individualAnalyses[0].score : 1;
    let currentLevel = levels.LOW;
    if (maxScore === 4) currentLevel = levels.CRITICAL;
    else if (maxScore === 3) currentLevel = levels.HIGH;
    else if (maxScore === 2) currentLevel = levels.MODERATE;

    // 3. Tipo de contaminación predominante
    let contaminationType = 'No detectable';
    let contaminationTypeDesc = 'No se registran contaminantes significativos.';
    if (maxScore > 1) {
      if (Math.abs(particulateScore - gaseousScore) <= 0.5) {
        contaminationType = 'Contaminación mixta';
        contaminationTypeDesc = 'Se detecta una presencia equilibrada de partículas suspendidas y gases contaminantes.';
      } else if (particulateScore > gaseousScore) {
        contaminationType = 'Contaminación particulada';
        contaminationTypeDesc = 'El deterioro ambiental se debe principalmente a material particulado (polvo, hollín, cenizas).';
      } else {
        contaminationType = 'Contaminación gaseosa';
        contaminationTypeDesc = 'La carga contaminante es mayoritariamente de origen químico/gaseoso.';
      }
    }

    // 4. Diagnóstico ambiental dinámico
    const topFactors = individualAnalyses.filter(f => f.score > 1).slice(0, 2);
    let diagnosis = 'La calidad ambiental se encuentra dentro de los parámetros estables.';
    if (topFactors.length === 1) {
      diagnosis = `La clasificación actual se encuentra influenciada principalmente por concentraciones elevadas de ${topFactors[0].name}.`;
    } else if (topFactors.length >= 2) {
      diagnosis = `La presencia de ${topFactors[0].name} y ${topFactors[1].name} representa la mayor contribución al nivel de contaminación observado.`;
    } else if (maxScore > 1) {
      diagnosis = 'Se detectan niveles de contaminación superiores a lo normal en diversas variables ambientales.';
    }

    // 5. Contaminante predominante (Mejorado)
    const mainP = individualAnalyses[0];
    const predominantPollutant = mainP ? {
      name: mainP.name,
      description: pollutantInfo[mainP.key].desc,
      reason: `Se considera predominante porque su valor (${mainP.value} ${mainP.unit}) representa un factor de ${mainP.deviation}, siendo el componente con mayor desviación ambiental en esta estación.`
    } : { name: '--', description: '--', reason: '--' };

    // 6. Fuentes probables (Inferencia por combinación)
    const sources = new Set();
    const highPM = (vars.pm25?.avg > 35 || vars.pm10?.avg > 154);
    const highCO = (vars.co?.avg > 9);
    const highH2S = (vars.h2s?.avg > 5);
    const highO3 = (vars.o3?.avg > 70);

    if (highPM && highCO) { sources.add('Tráfico vehicular intenso'); sources.add('Procesos de combustión de transporte pesado'); }
    else if (highPM) { sources.add('Obras de construcción cercanas'); sources.add('Resuspensión de polvo por viento'); }
    
    if (highH2S) { sources.add('Materia orgánica en descomposición'); sources.add('Sistemas de alcantarillado'); sources.add('Actividad industrial química'); }
    if (highO3) { sources.add('Reacciones fotoquímicas urbanas'); sources.add('Radiación solar intensa sobre precursores'); }
    if (vars.so2?.avg > 75 || vars.nox?.avg > 100) sources.add('Actividad industrial o calderas');

    if (sources.size === 0 && maxScore > 1) sources.add('Actividades urbanas difusas');
    if (sources.size === 0) sources.add('No se identifican fuentes predominantes');

    // 7. Recomendaciones específicas
    const recommendations = [];
    if (maxScore > 1) {
      recommendations.push('Incrementar la frecuencia de monitoreo de emisiones en la zona.');
      if (highPM) recommendations.push('Implementar medidas de control de polvo y humos visibles.');
      if (highCO || highO3) recommendations.push('Evaluar la gestión del tráfico vehicular en el área de influencia.');
      if (highH2S) recommendations.push('Revisar sistemas de gestión de residuos o drenajes.');
      recommendations.push('Fomentar acciones de mitigación ambiental local.');
    } else {
      recommendations.push('Mantener el monitoreo preventivo rutinario.');
      recommendations.push('Continuar con las prácticas actuales de gestión ambiental.');
    }

    return {
      id: dev.id,
      name: dev.name,
      lat: dev.lat,
      lng: dev.lng,
      classification: currentLevel.label,
      levelColor: currentLevel.color,
      score: maxScore,
      diagnosis,
      contaminationType,
      contaminationTypeDesc,
      factors: individualAnalyses,
      predominantPollutant,
      probableSources: Array.from(sources),
      recommendations: recommendations
    };
  });
}
