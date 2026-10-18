import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { once } from 'node:events';
import { config } from '../config.js';

const root = resolve(import.meta.dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  let path = resolve(root, `.${decodeURIComponent(request.url.split('?')[0])}`);
  if (!path.startsWith(`${root}/`) && path !== root) { response.writeHead(403).end(); return; }
  if (path === root || !extname(path)) path = join(root, 'index.html'); // like Cloudflare Pages' SPA fallback
  try {
    const file = await readFile(path);
    response.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    response.end(file);
  } catch { response.writeHead(404).end(); }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const port = server.address().port;
const profile = await mkdtemp(join(tmpdir(), 'screentime-chrome-'));
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const sleep = ms => new Promise(done => setTimeout(done, ms));
const price = (id, plan) => `Rs. ${new Intl.NumberFormat('en-NP').format(config.products.find(product => product.id === id).plans[plan])}`;
const hasWhatsApp = /^\d{10,15}$/.test(String(config.whatsappNumber).replace(/\D/g, ''));
const lowestPrice = `Rs. ${new Intl.NumberFormat('en-NP').format(Math.min(...config.products.flatMap(product => Object.values(product.plans))))}`;

try {
  let debuggerUrl;
  chrome.stderr.setEncoding('utf8');
  chrome.stderr.on('data', chunk => {
    debuggerUrl ||= chunk.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
  });
  for (let attempt = 0; attempt < 100 && !debuggerUrl; attempt++) await sleep(100);
  assert.ok(debuggerUrl, 'Chrome starts with a DevTools socket');
  const debugPort = new URL(debuggerUrl).port;
  const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((done, reject) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400 && message.params.response.url.startsWith(`http://127.0.0.1:${port}`)) errors.push(`${message.params.response.status} ${message.params.response.url}`);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  });
  function send(method, params = {}) {
    return new Promise((done, reject) => {
      const id = ++sequence;
      pending.set(id, message => message.error ? reject(Error(message.error.message)) : done(message.result));
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(`${result.exceptionDetails.exception?.description || result.exceptionDetails.text}; ${expression}; browser errors: ${errors.join('; ')}`);
    return result.result.value;
  }
  async function until(expression) {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    throw Error(`Timed out: ${expression}; URL: ${await evaluate('location.href')}; errors: ${errors.join('; ')}`);
  }
  const $ = selector => `document.querySelector(${JSON.stringify(selector)})`;
  const sheetOpen = `${$('#plan-dialog')}.open && ${$('#plan-dialog')}.style.getPropertyValue("--p") === "1"`;
  async function dragGrabber(distance, steps, stepDelay, hold = 0) {
    const { x, y } = await evaluate(`(() => { const r = ${$('#plan-dialog .grabber')}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    for (let step = 1; step <= steps; step++) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: y + distance * step / steps, button: 'left', buttons: 1 });
      await sleep(stepDelay);
    }
    await sleep(hold);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y: y + distance, button: 'left', buttons: 0, clickCount: 1 });
  }

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
  await until(`document.querySelectorAll(".tile").length === ${config.products.length}`);
  assert.equal(await evaluate('document.title'), 'ScreenTime Nepal — More of what you love.');
  assert.equal(await evaluate('getComputedStyle(document.body).backgroundColor'), 'rgb(255, 255, 255)', 'White even when the system prefers dark');
  assert.match(await evaluate('getComputedStyle(document.querySelector(".nav")).backdropFilter'), /blur/, 'Navigation uses a glass material');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".tile")).borderTopWidth'), '1px', 'Catalog tiles have a glass edge');

  // Scroll-in animations end in their final state: chat bubbles visible, stats counted up to the catalog's values.
  await evaluate(`${$('.chat')}.scrollIntoView({ behavior: "instant" })`);
  await until(`getComputedStyle(${$('.chat .bubble:last-child')}).opacity === "1"`);
  await evaluate(`${$('.stats')}.scrollIntoView({ behavior: "instant" })`);
  await until(`${$('.stat:nth-child(2)')}.classList.contains("visible") && ${$('#stat-from')}.textContent === "${lowestPrice}" && ${$('#stat-services')}.textContent === "${config.products.length}"`);
  await evaluate('scrollTo({ top: 0, behavior: "instant" })');

  // Month plans: pick 3 months, add to bag; the plan sheet hands off to the bag.
  await evaluate(`${$('#product-grid [data-product=netflix]')}.click()`);
  await until(`${$('#plan-dialog')}.open`);
  await evaluate(`${$('#plan-options input[value="3 months"]')}.click()`);
  await until(`${$('#plan-price')}.textContent === "${price('netflix', '3 months')}"`);
  await evaluate(`${$('#add-to-cart')}.click()`);
  assert.equal(await evaluate(`${$('#cart-count')}.textContent`), '1');
  await until(`${$('#cart-dialog')}.open && !${$('#plan-dialog')}.open`);
  assert.equal(await evaluate(`${$('#cart-total')}.textContent`), price('netflix', '3 months'));
  await evaluate(`${$('#cart-dialog .close-button')}.click()`);
  await until(`!${$('#cart-dialog')}.open`);

  // Variant plans (Shared/Private) use the same picker.
  await evaluate(`${$('#product-grid [data-product=gemini-ai-pro]')}.click()`);
  await until(`${$('#plan-dialog')}.open`);
  await evaluate(`${$('#plan-options input[value="Private profile"]')}.click()`);
  await until(`${$('#plan-price')}.textContent === "${price('gemini-ai-pro', 'Private profile')}"`);
  await evaluate(`${$('#add-to-cart')}.click()`);
  await until(`${$('#cart-dialog')}.open && !${$('#plan-dialog')}.open`);
  assert.equal(await evaluate(`${$('#cart-count')}.textContent`), '2');

  // Checkout builds the order message for the configured channel.
  await evaluate(`${$('#show-checkout')}.click()`);
  assert.equal(await evaluate(`${$('#checkout-view')}.hidden`), false);
  await evaluate(`${$('input[value=Khalti]')}.click()`);
  await evaluate(`const name = ${$('#customer-name')}; name.value = "Asha"; name.dispatchEvent(new Event("input", { bubbles: true }))`);
  const orderUrl = await evaluate(`${$('#whatsapp-checkout')}.href`);
  assert.match(orderUrl, hasWhatsApp ? /^https:\/\/wa\.me\/\d+\?text=/ : /^https:\/\/wa\.me\/\?text=/);
  const order = new URL(orderUrl).searchParams.get('text');
  assert.ok(order.includes(`Netflix — 3 months × 1: ${price('netflix', '3 months')}`), order);
  assert.ok(order.includes(`Gemini AI Pro — Private profile, 18 months × 1: ${price('gemini-ai-pro', 'Private profile')}`), order);
  assert.match(order, /Preferred payment: Khalti/);
  assert.match(order, /Name: Asha/);
  assert.equal(await evaluate(`${$('#whatsapp-checkout')}.hidden`), !hasWhatsApp && Boolean(config.instagramUrl));
  assert.equal(await evaluate(`${$('#instagram-checkout')}.hidden`), !config.instagramUrl);

  // The bag survives a reload, and items can be removed.
  await send('Page.reload', { ignoreCache: true });
  await until(`${$('#cart-count')}?.textContent === "2"`);
  await evaluate(`${$('#open-cart')}.click()`);
  await until(`${$('#cart-dialog')}.open`);
  await evaluate(`${$('[data-action=remove]')}.click()`);
  await evaluate(`${$('[data-action=remove]')}.click()`);
  assert.equal(await evaluate(`${$('#cart-count')}.textContent`), '0');
  assert.equal(await evaluate(`Boolean(${$('#empty-shop')})`), true);
  await evaluate(`${$('#cart-dialog .close-button')}.click()`);
  await until(`!${$('#cart-dialog')}.open`);

  // Phone layout: no overflow, and the sheet follows the finger.
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'No horizontal overflow on mobile');
  await evaluate(`${$('#product-grid [data-product=netflix]')}.click()`);
  await until(sheetOpen);
  await dragGrabber(40, 4, 40, 200); // a slow, short drag springs back
  await until(sheetOpen);
  await dragGrabber(200, 4, 10); // a flick dismisses
  await until(`!${$('#plan-dialog')}.open`);
  await evaluate(`${$('#product-grid [data-product=netflix]')}.click()`);
  await until(sheetOpen);
  await evaluate(`${$('#plan-dialog .close-button')}.click()`);
  await sleep(60);
  await dragGrabber(0, 0, 0, 500); // pressing and holding a closing sheet stops it under the finger
  await sleep(500);
  assert.equal(await evaluate(sheetOpen), true, 'Grabbing a closing sheet keeps it open');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await until(`!${$('#plan-dialog')}.open`);

  // Links from the previous site open the matching plan.
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/products/gemini-ai-pro` });
  await until(`${$('#plan-dialog')}?.open && ${$('#plan-title')}.textContent === "Gemini AI Pro"`);

  // Reduced motion: no entrance animations; sheets cross-fade instead of sliding.
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
  await until(`document.querySelectorAll(".tile").length === ${config.products.length}`);
  assert.equal(await evaluate('document.documentElement.classList.contains("js-reveal")'), false);
  assert.equal(await evaluate(`getComputedStyle(${$('.hero-icon')}).animationName`), 'none');
  assert.equal(await evaluate(`getComputedStyle(${$('.chat .bubble')}).opacity`), '1');
  assert.equal(await evaluate(`${$('#stat-from')}.textContent`), lowestPrice);
  await evaluate(`${$('#product-grid [data-product=spotify]')}.click()`);
  await until(`${$('#plan-dialog')}.open`);
  assert.equal(await evaluate(`getComputedStyle(${$('#plan-dialog .sheet-panel')}).transform`), 'none');

  assert.deepEqual(errors, [], 'No browser errors or missing assets');
  console.log('Smoke test passed: white theme, scroll-in animations, catalog, plan picker, bag, checkout, persistence, mobile gestures, legacy links, reduced motion, no console errors.');
  socket.close();
} finally {
  chrome.kill();
  server.close();
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
