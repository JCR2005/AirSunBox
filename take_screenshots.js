const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = '/home/carlos/Documentos/Sanik/screenshots';
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// Frontend is served by nginx on port 80 (via docker-compose), backend API on 3000
const FRONTEND_URL = 'http://localhost';  // nginx serves frontend on port 80
const API_URL = 'http://localhost:3000';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function takeScreenshot(page, name) {
  const file = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`📸 ${name}.png`);
  return `screenshots/${name}.png`;
}

async function login(page, email, password) {
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
  await page.type('input[type="email"], input[name="email"]', email);
  await page.type('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"], button:has-text("Entrar"), button:has-text("Iniciar")');
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
  console.log('✅ Login OK');
}

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  // Try to login with QA user (password unknown). Try common passwords or register new.
  const testEmail = 'qa-1789768261@test.com';
  const testPassword = 'Test1234!';  // common test password

  try {
    await login(page, testEmail, testPassword);
  } catch (e) {
    console.log('Login failed, trying to register...');
    // Try register
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
    // Look for register link
    const registerLink = await page.$('a[href*="register"], a:has-text("Registrarse"), a:has-text("Crear cuenta")');
    if (registerLink) {
      await registerLink.click();
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      await page.waitForSelector('input[type="email"]');
      await page.type('input[type="email"]', testEmail);
      await page.type('input[type="password"]', testPassword);
      await page.type('input[name="name"], input[placeholder*="nombre" i]', 'QA Test User');
      await page.type('input[name="orgName"], input[placeholder*="organización" i]', 'QA Org');
      // Select tipo B if dropdown
      const tipoSelect = await page.$('select[name="type"], select[name="orgType"]');
      if (tipoSelect) await tipoSelect.select('B');
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
      console.log('✅ Registered and logged in');
    } else {
      throw new Error('No register link found');
    }
  }

  const screenshots = {};

  // 1. Lista de espacios
  await page.goto(`${FRONTEND_URL}/espacios`, { waitUntil: 'networkidle0' });
  await sleep(1000);
  screenshots.espacios_lista = await takeScreenshot(page, '01_espacios_lista');

  // 2. Modal nuevo espacio (click + capture)
  await page.click('button:has-text("Nuevo espacio"), button:has-text("+"), a:has-text("Nuevo espacio")');
  await sleep(500);
  screenshots.espacio_nuevo = await takeScreenshot(page, '02_espacio_nuevo_modal');
  await page.keyboard.press('Escape'); // close modal
  await sleep(300);

  // 3. Entrar a un espacio (primer espacio de la lista)
  const espacioLink = await page.$('a[href*="/espacios/"], .space-card, [data-testid="space-card"]');
  if (espacioLink) {
    await espacioLink.click();
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    await sleep(1000);
    screenshots.dashboard = await takeScreenshot(page, '03_dashboard_espacio');

    // 4. Modal nueva estación
    await page.click('button:has-text("Nueva estación"), button:has-text("+ Estación")');
    await sleep(500);
    screenshots.estacion_nueva = await takeScreenshot(page, '04_estacion_nueva_modal');
    await page.keyboard.press('Escape');
    await sleep(300);

    // 5. Configurar AQI
    await page.click('button:has-text("Configurar AQI"), a:has-text("Configurar AQI"), button:has-text("AQI")');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    await sleep(1500);
    screenshots.aqi_paso1 = await takeScreenshot(page, '05_aqi_paso1_categorias');

    // Scroll to see variables step
    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(500);
    screenshots.aqi_paso2 = await takeScreenshot(page, '06_aqi_paso2_variables');

    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(500);
    screenshots.aqi_paso3 = await takeScreenshot(page, '07_aqi_paso3_limites');

    // 6. Detalle de estación (si hay alguna)
    await page.goto(`${FRONTEND_URL}/espacios`, { waitUntil: 'networkidle0' });
    await sleep(500);
    const primeraEstacion = await page.$('a[href*="/devices/"], .device-card');
    if (primeraEstacion) {
      await primeraEstacion.click();
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      await sleep(1500);
      screenshots.estacion_detalle = await takeScreenshot(page, '08_estacion_detalle');
    }

    // 7. Mapa público
    await page.goto(`${FRONTEND_URL}/mapa`, { waitUntil: 'networkidle0' });
    await sleep(2000);
    screenshots.mapa_publico = await takeScreenshot(page, '09_mapa_publico');
  }

  // 8. Login page (clean)
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
  await sleep(500);
  screenshots.login = await takeScreenshot(page, '00_login');

  // 9. Recuperar contraseña
  await page.click('a:has-text("Olvid"), a:has-text("¿Olvid")');
  await sleep(500);
  screenshots.recuperar = await takeScreenshot(page, '10_recuperar_password');

  await browser.close();

  // Save mapping for markdown injection
  fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'mapping.json'), JSON.stringify(screenshots, null, 2));
  console.log('\n✅ Capturas completadas:', Object.keys(screenshots).length);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});