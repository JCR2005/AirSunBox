const fs = require('fs');
const marked = require('marked');
const puppeteer = require('puppeteer');
const path = require('path');

// Read markdown
const md = fs.readFileSync('/home/carlos/Documentos/Sanik/MANUAL_INDEPENDIENTES.md', 'utf8');

// Load screenshots mapping
let screenshots = {};
try {
  screenshots = JSON.parse(fs.readFileSync('/home/carlos/Documentos/Sanik/screenshots/mapping.json', 'utf8'));
} catch (_) {}

// Build HTML with embedded screenshots
function injectScreenshots(html) {
  const replacements = {
    // Sección 2.1 - Registro
    '### 2.1 Creación de cuenta': `### 2.1 Creación de cuenta\n\n![Pantalla de login](${screenshots.login || 'screenshots/00_login.png'})`,
    // Sección 2.2 - Login
    '### 2.2 Inicio de sesión': `### 2.2 Inicio de sesión\n\n![Pantalla de login](${screenshots.login || 'screenshots/00_login.png'})`,
    // Sección 2.3 - Recuperar
    '### 2.3 Recuperación de contraseña': `### 2.3 Recuperación de contraseña\n\n![Recuperar contraseña](${screenshots.recuperar || 'screenshots/10_recuperar_password.png'})`,
    // Sección 3.2 - Crear espacio
    '### 3.2 Crear un espacio': `### 3.2 Crear un espacio\n\n![Lista de espacios](${screenshots.espacios_lista || 'screenshots/01_espacios_lista.png'})\n\n![Modal nuevo espacio](${screenshots.espacio_nuevo || 'screenshots/02_espacio_nuevo_modal.png'})`,
    // Sección 4 - Dashboard
    '### 4.1 Qué es un espacio': `### 4.1 Qué es un espacio\n\n![Dashboard del espacio](${screenshots.dashboard || 'screenshots/03_dashboard_espacio.png'})`,
    // Sección 5.1 - Nueva estación
    '### 5.1 Crear una estación': `### 5.1 Crear una estación\n\n![Modal nueva estación](${screenshots.estacion_nueva || 'screenshots/04_estacion_nueva_modal.png'})`,
    // Sección 6 - AQI
    '### 6.1 Paso 1 — Categorías': `### 6.1 Paso 1 — Categorías del índice\n\n![Paso 1: Categorías](${screenshots.aqi_paso1 || 'screenshots/05_aqi_paso1_categorias.png'})`,
    '### 6.2 Paso 2 — Variables': `### 6.2 Paso 2 — Variables del AQI\n\n![Paso 2: Variables](${screenshots.aqi_paso2 || 'screenshots/06_aqi_paso2_variables.png'})`,
    '### 6.3 Paso 3 — Límites': `### 6.3 Paso 3 — Límites por variable y categoría\n\n![Paso 3: Límites](${screenshots.aqi_paso3 || 'screenshots/07_aqi_paso3_limites.png'})`,
    // Sección 5.4 - Detalle estación
    '### 5.4 Ver detalle': `### 5.4 Ver detalle de una estación\n\n![Detalle de estación](${screenshots.estacion_detalle || 'screenshots/08_estacion_detalle.png'})`,
    // Sección 7 - Mapa público
    '### 7.1 Mapa público': `### 7.1 Mapa público\n\n![Mapa público](${screenshots.mapa_publico || 'screenshots/09_mapa_publico.png'})`,
  };

  let result = html;
  for (const [heading, replacement] of Object.entries(replacements)) {
    result = result.replace(new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), replacement);
  }
  return result;
}

const html = marked.parse(md);
const htmlWithShots = injectScreenshots(html);

const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <style>
    body { font-family: 'DejaVu Sans', Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
    h1 { color: #1a3c5e; border-bottom: 2px solid #67B7E8; padding-bottom: 8px; }
    h2 { color: #2c5f7c; margin-top: 32px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
    h3 { color: #3a7ca5; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f5f8fa; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    pre { background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 6px; overflow-x: auto; }
    blockquote { border-left: 4px solid #67B7E8; padding-left: 16px; color: #555; margin: 16px 0; }
    hr { border: 0; border-top: 1px solid #eee; margin: 32px 0; }
    img { max-width: 100%; height: auto; border: 1px solid #e0e0e0; border-radius: 8px; margin: 12px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .missing-img { background: #fff3cd; border: 1px dashed #ffc107; padding: 20px; text-align: center; color: #856404; border-radius: 8px; margin: 12px 0; }
    .cover { text-align: center; padding: 80px 0; page-break-after: always; }
    .cover h1 { border: none; font-size: 2.5em; }
    .cover p { font-size: 1.2em; color: #666; }
    @media print { img { page-break-inside: avoid; } }
  </style>
</head>
<body>${htmlWithShots}</body>
</html>
`;

(async () => {
  try {
    const browser = await puppeteer.launch({ 
      headless: 'new', 
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--single-process', '--no-zygote'] 
    });
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.pdf({
      path: '/home/carlos/Documentos/Sanik/MANUAL_INDEPENDIENTES.pdf',
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
    });
    await browser.close();
    const stats = fs.statSync('/home/carlos/Documentos/Sanik/MANUAL_INDEPENDIENTES.pdf');
    console.log('✅ PDF generado:', Math.round(stats.size/1024), 'KB');
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();