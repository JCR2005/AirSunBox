const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = '/home/carlos/Documentos/Sanik/screenshots';
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const FRONTEND_URL = 'http://localhost';
const API_URL = 'http://localhost:3000';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function takeScreenshot(page, name) {
  const file = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`📸 ${name}.png`);
  return `screenshots/${name}.png`;
}

async function clickByText(page, text) {
  await page.evaluate((t) => {
    const els = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    const el = els.find(e => e.textContent && e.textContent.includes(t));
    if (el) el.click();
  }, text);
  await sleep(500);
}

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  // 1. Register a test user via API and get token
  console.log('🔐 Registering test user via API...');
  const regRes = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `manual_test_${Date.now()}@sanik.io`,
      password: 'Manual123!',
      confirmPassword: 'Manual123!',
      name: 'Manual Test User',
      orgName: 'Manual Test Org',
      type: 'B'
    })
  });
  const regData = await regRes.json();
  const token = regData.token;
  console.log('✅ Got token:', token.slice(0, 30) + '...');

  // 2. Go to login page, inject token into localStorage, then navigate to /espacios
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(500);
  
  // Inject auth token - app uses 'sanik_token' key
  await page.evaluate((t) => {
    localStorage.setItem('sanik_token', t);
  }, token);

  // Verify token works by calling /auth/me
  await page.evaluate(async (t) => {
    try {
      const res = await fetch('http://localhost:3000/api/auth/me', {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      const data = await res.json();
      console.log('Auth me:', data);
    } catch (e) {
      console.log('Auth me error:', e);
    }
  }, token);

  const screenshots = {};

  // 3. Login page (clean)
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(500);
  screenshots.login = await takeScreenshot(page, '00_login');

  // 4. Go directly to /espacios (should work with token)
  await page.goto(`${FRONTEND_URL}/espacios`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2000);
  screenshots.espacios_lista = await takeScreenshot(page, '01_espacios_lista');

  // 5. Modal nuevo espacio
  await clickByText(page, 'Nuevo espacio');
  await sleep(500);
  screenshots.espacio_nuevo = await takeScreenshot(page, '02_espacio_nuevo_modal');
  await page.keyboard.press('Escape');
  await sleep(300);

  // 6. Entrar a un espacio (primer link /espacios/)
  const espacioClicked = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/espacios/"]'));
    if (links.length) { links[0].click(); return true; }
    return false;
  });
  if (espacioClicked) {
    await sleep(2000);
    screenshots.dashboard = await takeScreenshot(page, '03_dashboard_espacio');

    // 7. Modal nueva estación
    await clickByText(page, 'Nueva estación');
    await sleep(500);
    screenshots.estacion_nueva = await takeScreenshot(page, '04_estacion_nueva_modal');
    await page.keyboard.press('Escape');
    await sleep(300);

    // 8. Configurar AQI
    await clickByText(page, 'Configurar AQI');
    await sleep(2000);
    screenshots.aqi_paso1 = await takeScreenshot(page, '05_aqi_paso1_categorias');

    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(500);
    screenshots.aqi_paso2 = await takeScreenshot(page, '06_aqi_paso2_variables');

    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(500);
    screenshots.aqi_paso3 = await takeScreenshot(page, '07_aqi_paso3_limites');

    // 9. Detalle de estación
await page.goto(`${FRONTEND_URL}/espacios`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(500);
    const estClicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/devices/"]'));
      if (links.length) { links[0].click(); return true; }
      return false;
    });
    if (estClicked) {
      await sleep(2000);
      screenshots.estacion_detalle = await takeScreenshot(page, '08_estacion_detalle');
    }
  }

  // 10. Mapa público
  await page.goto(`${FRONTEND_URL}/mapa`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2000);
  await sleep(3000);
  screenshots.mapa_publico = await takeScreenshot(page, '09_mapa_publico');

  // 11. Recuperar contraseña
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
  await sleep(500);
  await clickByText(page, 'Olvid');
  await sleep(500);
  screenshots.recuperar = await takeScreenshot(page, '10_recuperar_password');

  await browser.close();

  fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'mapping.json'), JSON.stringify(screenshots, null, 2));
  console.log('\n✅ Capturas completadas:', Object.keys(screenshots).length);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});