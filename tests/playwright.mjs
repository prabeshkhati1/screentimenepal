import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { config } from '../config.js';

const root = resolve(import.meta.dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  let path;
  try {
    path = resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (!path.startsWith(`${root}/`) && path !== root) { response.writeHead(403).end(); return; }
  if (path === root || !extname(path)) path = join(root, 'index.html');
  try {
    const file = await readFile(path);
    response.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    response.end(file);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolveServer, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolveServer);
});
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;
const price = (id, plan) => `Rs. ${new Intl.NumberFormat('en-NP').format(config.products.find(product => product.id === id).plans[plan])}`;
const lowestPrice = `Rs. ${new Intl.NumberFormat('en-NP').format(Math.min(...config.products.flatMap(product => Object.values(product.plans))))}`;

const waitFor = async (page, predicate, arg, message) => {
  await page.waitForFunction(predicate, arg, { timeout: 5000 });
  if (message) assert.ok(true, message);
};

const openPlan = async (page, productId) => {
  await page.locator(`#product-grid [data-product="${productId}"]`).click();
  await page.locator('#plan-dialog[open]').waitFor();
};

const dragGrabber = async (page, distance, steps, stepDelay = 0) => {
  const box = await page.locator('#plan-dialog .grabber').boundingBox();
  assert.ok(box, 'Plan sheet grabber is visible');
  const x = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(x, startY);
  await page.mouse.down();
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(x, startY + distance * step / steps);
    if (stepDelay) await new Promise(resolveDelay => setTimeout(resolveDelay, stepDelay));
  }
  await page.mouse.up();
};

const browserErrors = [];
const watchPage = page => {
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`); });
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(baseUrl)) browserErrors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  return page;
};
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const browserVersion = browser.version();
  assert.match(browserVersion, /^\d+(?:\.\d+){2,3}$/, `Playwright launched Chromium ${browserVersion}`);

  const context = await browser.newContext({
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
    viewport: { width: 1280, height: 900 },
  });
  const page = watchPage(await context.newPage());

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  assert.equal(await page.title(), 'ScreenTime Nepal — More of what you love.');
  assert.equal(await page.locator('.tile').count(), config.products.length);
  assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)');
  assert.match(await page.locator('.nav').evaluate(element => getComputedStyle(element).backdropFilter), /blur/);
  assert.equal(await page.locator('.tile').first().evaluate(element => getComputedStyle(element).borderTopWidth), '1px');

  await page.locator('.chat').scrollIntoViewIfNeeded();
  await waitFor(page, () => getComputedStyle(document.querySelector('.chat .bubble:last-child')).opacity === '1');
  await page.locator('.stats').scrollIntoViewIfNeeded();
  await waitFor(page, expected => document.querySelector('.stat:nth-child(2)').classList.contains('visible') && document.querySelector('#stat-from').textContent === expected, lowestPrice);

  await openPlan(page, 'netflix');
  await page.locator('#plan-options label:has(input[value="3 months"])').click();
  await waitFor(page, expected => document.querySelector('#plan-price').textContent === expected, price('netflix', '3 months'));
  await page.locator('#add-to-cart').click();
  assert.equal(await page.locator('#cart-count').textContent(), '1');
  await page.locator('#cart-dialog[open]').waitFor();
  assert.equal(await page.locator('#cart-total').textContent(), price('netflix', '3 months'));
  await page.locator('#cart-dialog .close-button').click();
  await page.waitForFunction(() => !document.querySelector('#cart-dialog').open);

  await openPlan(page, 'gemini-ai-pro');
  await page.locator('#plan-options label:has(input[value="Private profile"])').click();
  await waitFor(page, expected => document.querySelector('#plan-price').textContent === expected, price('gemini-ai-pro', 'Private profile'));
  await page.locator('#add-to-cart').click();
  await page.locator('#cart-dialog[open]').waitFor();
  await page.locator('#show-checkout').click();
  await page.locator('#checkout-view:not([hidden])').waitFor();
  await page.locator('label:has(input[value="Khalti"])').click();
  await page.locator('#customer-name').fill('Asha');
  const orderUrl = new URL(await page.locator('#whatsapp-checkout').getAttribute('href'));
  assert.equal(orderUrl.hostname, 'wa.me');
  const order = orderUrl.searchParams.get('text');
  assert.ok(order.includes(`Netflix — 3 months × 1: ${price('netflix', '3 months')}`));
  assert.ok(order.includes(`Gemini AI Pro — Private profile, 18 months × 1: ${price('gemini-ai-pro', 'Private profile')}`));
  assert.match(order, /Preferred payment: Khalti/);
  assert.match(order, /Name: Asha/);

  await page.reload({ waitUntil: 'networkidle' });
  await waitFor(page, () => document.querySelector('#cart-count')?.textContent === '2');
  await page.locator('#open-cart').click();
  await page.locator('#cart-dialog[open]').waitFor();
  await page.locator('[data-action="remove"]').first().click();
  await page.locator('[data-action="remove"]').first().click();
  assert.equal(await page.locator('#cart-count').textContent(), '0');
  assert.equal(await page.locator('#empty-shop').count(), 1);

  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, reducedMotion: 'no-preference' });
  const mobilePage = watchPage(await mobile.newPage());
  await mobilePage.goto(baseUrl, { waitUntil: 'networkidle' });
  assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await openPlan(mobilePage, 'netflix');
  await dragGrabber(mobilePage, 40, 4, 20);
  await mobilePage.locator('#plan-dialog[open]').waitFor();
  await dragGrabber(mobilePage, 220, 4, 10);
  await mobilePage.waitForFunction(() => !document.querySelector('#plan-dialog').open);
  assert.equal(await mobilePage.locator('#plan-dialog').evaluate(element => element.open), false);
  await mobile.close();

  await page.goto(`${baseUrl}/products/gemini-ai-pro`, { waitUntil: 'networkidle' });
  await page.locator('#plan-dialog[open]').waitFor();
  assert.equal(await page.locator('#plan-title').textContent(), 'Gemini AI Pro');
  await context.close();

  const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  const reducedPage = watchPage(await reduced.newPage());
  await reducedPage.goto(baseUrl, { waitUntil: 'networkidle' });
  assert.equal(await reducedPage.locator('html').evaluate(element => element.classList.contains('js-reveal')), false);
  assert.equal(await reducedPage.locator('.hero-icon').first().evaluate(element => getComputedStyle(element).animationName), 'none');
  await openPlan(reducedPage, 'spotify');
  assert.equal(await reducedPage.locator('#plan-dialog .sheet-panel').evaluate(element => getComputedStyle(element).transform), 'none');
  await reduced.close();

  assert.deepEqual(browserErrors, []);
  console.log(`Playwright smoke test passed with headless Chromium ${browserVersion}: glass materials, catalog, animated plan picker, bag, checkout, persistence, mobile sheet gesture, legacy links and reduced motion.`);
} finally {
  await browser?.close();
  await new Promise(resolveServer => server.close(resolveServer));
}
