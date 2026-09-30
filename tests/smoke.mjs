import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { once } from 'node:events';

const root = resolve(import.meta.dirname, '..');
const server = createServer(async (request, response) => {
  const path = resolve(root, `.${decodeURIComponent(request.url.split('?')[0])}`);
  if (!path.startsWith(`${root}/`) && path !== root) { response.writeHead(403).end(); return; }
  try {
    const file = await readFile(path === root ? join(root, 'index.html') : path);
    response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[path === root ? '.html' : extname(path)] || 'application/octet-stream');
    response.end(file);
  } catch { response.writeHead(404).end(); }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const port = server.address().port;
const profile = await mkdtemp(join(tmpdir(), 'screentime-chrome-'));
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });

try {
  let debuggerUrl;
  chrome.stderr.setEncoding('utf8');
  chrome.stderr.on('data', chunk => {
    debuggerUrl ||= chunk.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
  });
  for (let attempt = 0; attempt < 100 && !debuggerUrl; attempt++) await new Promise(done => setTimeout(done, 100));
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
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
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
      await new Promise(done => setTimeout(done, 100));
    }
    throw Error(`Timed out: ${expression}; URL: ${await evaluate('location.href')}; document: ${await evaluate('document.body?.innerText.slice(0,120)')}; errors: ${errors.join('; ')}`);
  }
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
  await until('document.querySelectorAll(".product-card").length === 4');
  assert.equal(await evaluate('document.title'), 'ScreenTime Nepal — More of what you love.');
  await evaluate('document.querySelector("[data-product=netflix]").click()');
  assert.equal(await evaluate('document.querySelector("#plan-dialog").open'), true);
  await evaluate('document.querySelector("[data-months=\\"3\\"]").click()');
  await until('document.querySelector("#plan-price").textContent === "Rs. 1,399"');
  await evaluate('document.querySelector("#add-to-cart").click()');
  assert.equal(await evaluate('document.querySelector("#cart-count").textContent'), '1');
  assert.equal(await evaluate('document.querySelector("#cart-total").textContent'), 'Rs. 1,399');
  await evaluate('document.querySelector("#show-checkout").click()');
  await evaluate('document.querySelector("input[value=Khalti]").click()');
  await evaluate('document.querySelector("#customer-name").value = "Asha"; document.querySelector("#customer-name").dispatchEvent(new Event("input"))');
  const orderUrl = await evaluate('document.querySelector("#whatsapp-checkout").href');
  assert.match(orderUrl, /^https:\/\/wa\.me\/\?text=/);
  const order = decodeURIComponent(new URL(orderUrl).searchParams.get('text'));
  assert.match(order, /Netflix — 3 months × 1: Rs\. 1,399/);
  assert.match(order, /Preferred payment: Khalti/);
  assert.match(order, /Name: Asha/);
  await send('Page.reload', { ignoreCache: true });
  await until('document.querySelector("#cart-count")?.textContent === "1"');
  await evaluate('document.querySelector("#open-cart").click(); document.querySelector("[data-action=remove]").click()');
  assert.equal(await evaluate('document.querySelector("#cart-count").textContent'), '0');
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'No horizontal overflow on mobile');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".marquee-track")).animationDuration'), '1e-05s');
  assert.deepEqual(errors, [], 'No browser errors or missing assets');
  console.log('Smoke test passed: page, local assets, plan picker, cart, checkout, mobile, reduced motion, no console errors.');
  socket.close();
} finally {
  chrome.kill();
  server.close();
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
