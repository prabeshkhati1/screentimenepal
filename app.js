import { config } from './config.js';

const $ = selector => document.querySelector(selector);
const productById = new Map(config.products.map(product => [product.id, product]));
const formatPrice = value => `Rs. ${new Intl.NumberFormat('en-NP').format(value)}`;
const planText = (product, plan) => product.term ? `${plan}, ${product.term}` : plan;
const icon = product => `<span class="app-icon ${product.id}"><img src="/assets/${product.id}.svg" alt=""></span>`;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const phoneLayout = matchMedia('(max-width: 47.99em)');
const ease = 'cubic-bezier(.28, .11, .32, 1)';
const cartKey = 'screentime-nepal-cart';
const whatsappNumber = String(config.whatsappNumber).replace(/\D/g, '');
const hasWhatsApp = /^\d{10,15}$/.test(whatsappNumber);
const instagramHandle = /^https:\/\/(?:www\.)?instagram\.com\/([\w.]+)/.exec(config.instagramUrl)?.[1];
const whatsappLink = text => `https://wa.me/${hasWhatsApp ? whatsappNumber : ''}?text=${encodeURIComponent(text)}`;

// Apple-style spring: damping ratio + response in seconds (WWDC18, "Designing Fluid Interfaces").
// Each animation starts from the live value and velocity, so it can be interrupted or retargeted at any time.
function spring(apply, value = 0) {
  let velocity = 0, frame = 0, settle;
  const stop = () => { cancelAnimationFrame(frame); settle?.(false); settle = undefined; };
  return {
    get value() { return value; },
    stop,
    set(next) { stop(); velocity = 0; apply(value = next); },
    to(target, { damping = 1, response = .35, velocity: initial = velocity, precision = .001 } = {}) {
      stop();
      velocity = initial;
      const stiffness = (2 * Math.PI / response) ** 2, friction = 4 * Math.PI * damping / response;
      let last = performance.now();
      return new Promise(resolve => {
        settle = resolve;
        const tick = now => {
          const elapsed = Math.min(Math.max(now - last, 0), 64) / 1000;
          last = now;
          for (let time = 0; time < elapsed; time += 1 / 240) { // small fixed steps keep stiff springs stable
            const step = Math.min(1 / 240, elapsed - time);
            velocity += (-stiffness * (value - target) - friction * velocity) * step;
            value += velocity * step;
          }
          if (Math.abs(value - target) < precision && Math.abs(velocity) < precision * 10) {
            settle = undefined;
            velocity = 0;
            apply(value = target);
            resolve(true);
          } else {
            apply(value);
            frame = requestAnimationFrame(tick);
          }
        };
        frame = requestAnimationFrame(tick);
      });
    },
  };
}

// Soft boundaries and momentum projection, from the same talk.
const rubberband = (offset, dimension, constant = .55) => offset * dimension * constant / (dimension + constant * Math.abs(offset));
const project = (velocity, decelerationRate = .998) => velocity / 1000 * decelerationRate / (1 - decelerationRate);

// A bottom sheet on phones (drag, flick or tap outside to dismiss); a centered card or side panel on larger screens.
function sheet(dialog) {
  const panel = dialog.querySelector('.sheet-panel');
  const grab = dialog.querySelector('[data-grab]');
  const progress = spring(value => dialog.style.setProperty('--p', value));
  const close = async velocity => {
    if (!dialog.open || !await progress.to(0, { velocity, response: .3 })) return false;
    dialog.close();
    return true;
  };
  const open = origin => {
    if (!dialog.open) {
      progress.set(0);
      dialog.showModal();
      // Grow from the element that was tapped, and shrink back into it on close.
      const rect = origin?.getBoundingClientRect();
      panel.style.transformOrigin = rect ? `${rect.x + rect.width / 2 - (dialog.clientWidth - panel.offsetWidth) / 2}px ${rect.y + rect.height / 2 - (dialog.clientHeight - panel.offsetHeight) / 2}px` : '';
    }
    return progress.to(1, { response: .4 });
  };
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => progress.set(0));
  dialog.addEventListener('click', event => { if (event.target.closest('[data-close]')) close(); });
  grab.addEventListener('pointerdown', event => {
    if (!phoneLayout.matches || reducedMotion.matches || event.button > 0 || event.target.closest('button')) return;
    progress.stop(); // grabbing mid-flight takes over from wherever the sheet is
    const height = panel.offsetHeight, start = progress.value, startY = event.clientY, samples = [];
    grab.setPointerCapture(event.pointerId);
    const move = moveEvent => {
      samples.push([moveEvent.timeStamp, moveEvent.clientY]);
      const next = start - (moveEvent.clientY - startY) / height;
      progress.set(next > 1 ? 1 + rubberband((next - 1) * height, height) / height : next);
    };
    const end = endEvent => {
      grab.removeEventListener('pointermove', move);
      grab.removeEventListener('pointerup', end);
      grab.removeEventListener('pointercancel', end);
      const recent = samples.filter(([time]) => endEvent.timeStamp - time < 100);
      const [t0, y0] = recent[0] ?? [], [t1, y1] = recent.at(-1) ?? [];
      const velocity = t1 > t0 ? (y1 - y0) / (t1 - t0) * 1000 : 0; // px/s, positive is downward
      // Pick the destination from where the flick would come to rest, then hand its velocity to the spring.
      if (endEvent.type === 'pointerup' && (1 - progress.value) * height + project(velocity) > height / 2) close(-velocity / height);
      else progress.to(1, { damping: .8, response: .3, velocity: -velocity / height });
    };
    grab.addEventListener('pointermove', move);
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
  });
  return { open, close };
}

const planSheet = sheet($('#plan-dialog'));
const bagSheet = sheet($('#cart-dialog'));
const thumbElement = $('.segmented-thumb');
const thumb = spring(index => { thumbElement.style.transform = `translateX(${index * 100}%)`; });
const price = spring(value => { $('#plan-price').textContent = formatPrice(Math.round(value)); });

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(cartKey));
    if (!Array.isArray(saved)) return [];
    return saved.filter(item => Object.hasOwn(productById.get(item?.id)?.plans ?? {}, item?.plan)
      && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 20)
      .map(({ id, plan, quantity }) => ({ id, plan, quantity }));
  } catch {
    return [];
  }
}

let cart = readCart();
let selected;
let toastTimer;

function saveCart() {
  try { localStorage.setItem(cartKey, JSON.stringify(cart)); } catch { /* Storage may be disabled. */ }
  renderCart();
}

const total = () => cart.reduce((sum, item) => sum + productById.get(item.id).plans[item.plan] * item.quantity, 0);

function renderProducts() {
  $('#hero-services').textContent = new Intl.ListFormat('en').format(config.products.map(product => product.name));
  $('#hero-icons').innerHTML = config.products.map((product, index) => `<button class="hero-icon" type="button" data-product="${product.id}" data-brand="${product.id}" style="--i:${index}" aria-label="${product.name} plans">${icon(product)}</button>`).join('');
  $('#closing-icons').innerHTML = config.products.map((product, index) => `<span class="closing-icon" data-brand="${product.id}" style="--o:${index - (config.products.length - 1) / 2}">${icon(product)}</span>`).join('');
  $('#stat-services').textContent = config.products.length;
  $('#stat-from').textContent = formatPrice(Math.min(...config.products.flatMap(product => Object.values(product.plans))));
  $('#product-grid').innerHTML = config.products.map((product, index) => {
    const [[plan, amount], ...others] = Object.entries(product.plans).sort((a, b) => a[1] - b[1]);
    return `<article class="tile reveal" data-brand="${product.id}" style="--i:${index % 3}">${icon(product)}<p class="tile-category">${product.category}</p><h3>${product.name}</h3><p class="tile-line">${product.line}</p><p class="tile-price">${others.length ? 'From ' : ''}${formatPrice(amount)} <span>${planText(product, plan)}</span></p><button class="pill" type="button" data-product="${product.id}">Choose<span class="visually-hidden"> a ${product.name} plan</span></button></article>`;
  }).join('');
}

function choosePlan(plan, animate) {
  const { product } = selected, amount = product.plans[plan], months = parseInt(product.term ?? plan, 10);
  const index = Object.keys(product.plans).indexOf(plan);
  selected.plan = plan;
  $('#plan-caption').textContent = months > 1 ? `${formatPrice(Math.round(amount / months))}/mo over ${months} months` : `for ${planText(product, plan)}`;
  if (animate && !reducedMotion.matches) {
    thumb.to(index, { response: .3 });
    price.to(amount, { precision: .5 });
  } else {
    thumb.set(index);
    price.set(amount);
  }
}

function openPlan(id, origin) {
  const product = productById.get(id);
  if (!product) return;
  const plans = Object.keys(product.plans);
  selected = { product };
  $('#plan-dialog').dataset.brand = id;
  $('#plan-icon').innerHTML = icon(product);
  $('#plan-title').textContent = product.name;
  $('#plan-line').textContent = product.line;
  $('#plan-note').textContent = product.note ?? '';
  $('#plan-note').hidden = !product.note;
  $('#plan-options').hidden = plans.length < 2;
  $('#plan-options').style.setProperty('--n', plans.length);
  $('#plan-option-list').innerHTML = plans.map((plan, index) => `<label><input type="radio" name="plan" value="${plan}"${index ? '' : ' checked'}><span>${plan}<span class="visually-hidden">, ${formatPrice(product.plans[plan])}</span></span></label>`).join('');
  choosePlan(plans[0], false);
  planSheet.open(origin);
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  if (!toast.matches(':popover-open')) toast.showPopover?.();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.hidePopover?.(), 2600);
}

function renderCart() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  $('#cart-count').textContent = count;
  $('#cart-count').hidden = !count;
  $('#open-cart').setAttribute('aria-label', `Open bag, ${count} ${count === 1 ? 'item' : 'items'}`);
  $('#cart-total').textContent = $('#checkout-total').textContent = formatPrice(total());
  $('#show-checkout').disabled = !cart.length;
  const focused = document.activeElement?.closest('#cart-items [data-action]');
  $('#cart-items').innerHTML = cart.length ? cart.map((item, index) => {
    const product = productById.get(item.id);
    return `<div class="cart-item">${icon(product)}<div><h3>${product.name}</h3><p class="cart-item-plan">${planText(product, item.plan)}</p></div><span class="cart-item-price">${formatPrice(product.plans[item.plan] * item.quantity)}</span><div class="cart-item-actions"><div class="stepper"><button type="button" data-action="decrease" data-index="${index}" aria-label="Decrease ${product.name} quantity">−</button><span>${item.quantity}</span><button type="button" data-action="increase" data-index="${index}" aria-label="Increase ${product.name} quantity"${item.quantity >= 20 ? ' disabled' : ''}>+</button></div><button class="remove" type="button" data-action="remove" data-index="${index}" aria-label="Remove ${product.name}">Remove</button></div></div>`;
  }).join('') : `<div class="empty-bag"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.1 12.1a1 1 0 0 1-1 .9H7.1a1 1 0 0 1-1-.9L5 8Z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/></svg><h3>Your bag is empty.</h3><p>Find a plan you'll love.</p><button class="button" type="button" id="empty-shop">Browse plans</button></div>`;
  // Re-rendering replaces the buttons, so keep keyboard focus on the equivalent control.
  if (focused) ($(`#cart-items [data-action="${focused.dataset.action}"][data-index="${focused.dataset.index}"]:not(:disabled)`) ?? $('#cart-dialog .close-button')).focus();
  updateOrderLinks();
}

function orderMessage() {
  const payment = document.querySelector('input[name="payment"]:checked')?.value ?? 'eSewa';
  const name = $('#customer-name').value.trim();
  const lines = cart.map(item => {
    const product = productById.get(item.id);
    return `• ${product.name} — ${planText(product, item.plan)} × ${item.quantity}: ${formatPrice(product.plans[item.plan] * item.quantity)}`;
  });
  return `Hi ScreenTime Nepal! I'd like to order:\n\n${lines.join('\n')}\n\nEstimated total: ${formatPrice(total())}\nPreferred payment: ${payment}${name ? `\nName: ${name}` : ''}\n\nPlease confirm availability, plan details and verified payment instructions before I pay.`;
}

function updateOrderLinks() {
  $('#whatsapp-checkout').href = whatsappLink(orderMessage());
}

function showView(view, from) {
  for (const other of [$('#bag-view'), $('#checkout-view')]) other.hidden = other !== view;
  $('#cart-title').textContent = view.id === 'checkout-view' ? 'Checkout' : 'Bag';
  view.animate(reducedMotion.matches ? { opacity: [0, 1] } : { opacity: [0, 1], translate: [`${from} 0`, '0 0'] }, { duration: 350, easing: ease });
}

function openCart() {
  $('#checkout-view').hidden = true;
  $('#bag-view').hidden = false;
  $('#cart-title').textContent = 'Bag';
  bagSheet.open();
}

// Order channels: WhatsApp needs a configured number; Instagram can't prefill a DM, so the order is copied.
const channels = [hasWhatsApp && 'WhatsApp', instagramHandle && 'Instagram'].filter(Boolean);
const checkoutNote = instagramHandle ? 'Instagram opens with your order copied, ready to paste.' : hasWhatsApp ? '' : 'No shop number is set yet, so WhatsApp opens a share message instead.';
document.querySelectorAll('[data-channels]').forEach(element => { element.textContent = new Intl.ListFormat('en', { type: 'disjunction' }).format(channels.length ? channels : ['WhatsApp']); });
$('#whatsapp-checkout').hidden = !hasWhatsApp && Boolean(instagramHandle);
$('#instagram-checkout').hidden = !instagramHandle;
$('#instagram-checkout').href = `https://ig.me/m/${instagramHandle}`;
$('#instagram-checkout').classList.toggle('button-secondary', !$('#whatsapp-checkout').hidden);
$('#checkout-note').textContent = checkoutNote;
$('#checkout-note').hidden = !checkoutNote;
$('#footer-whatsapp').href = whatsappLink('Hi ScreenTime Nepal! I have a question about your plans.');
$('#footer-whatsapp').hidden = !hasWhatsApp;
if (instagramHandle) {
  $('#footer-instagram').href = config.instagramUrl;
  $('#footer-instagram').textContent = `Instagram @${instagramHandle}`;
  $('#footer-instagram').hidden = false;
}
$('#year').textContent = new Date().getFullYear();

renderProducts();
renderCart();

document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-product]');
  if (trigger) openPlan(trigger.dataset.product, trigger.closest('.tile') ?? trigger);
});
document.addEventListener('touchstart', () => {}, { passive: true }); // lets iOS Safari show :active press states
// Hovered icons tilt toward the pointer and catch the light; tiles get a spotlight (see --x/--y in styles.css).
document.addEventListener('pointermove', event => {
  const target = event.pointerType === 'mouse' && event.target.closest('.hero-icon, .tile');
  if (!target) return;
  const rect = target.getBoundingClientRect();
  target.style.setProperty('--x', ((event.clientX - rect.left) / rect.width).toFixed(3));
  target.style.setProperty('--y', ((event.clientY - rect.top) / rect.height).toFixed(3));
});
$('#plan-options').addEventListener('change', event => choosePlan(event.target.value, true));
$('#add-to-cart').addEventListener('click', async () => {
  const { product, plan } = selected;
  const existing = cart.find(item => item.id === product.id && item.plan === plan);
  if (existing) existing.quantity = Math.min(20, existing.quantity + 1);
  else cart.push({ id: product.id, plan, quantity: 1 });
  saveCart();
  if (!reducedMotion.matches) $('#cart-count').animate({ scale: [1, 1.4, 1] }, { duration: 450, easing: ease });
  if (await planSheet.close()) openCart();
});
$('#open-cart').addEventListener('click', openCart);
$('#cart-items').addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (button) {
    const index = Number(button.dataset.index), item = cart[index];
    if (button.dataset.action === 'remove' || (button.dataset.action === 'decrease' && item.quantity === 1)) cart.splice(index, 1);
    else item.quantity = Math.max(1, Math.min(20, item.quantity + (button.dataset.action === 'increase' ? 1 : -1)));
    saveCart();
  }
  if (event.target.closest('#empty-shop') && await bagSheet.close()) $('#plans').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' });
});
$('#show-checkout').addEventListener('click', () => {
  showView($('#checkout-view'), '2rem');
  $('#back-to-bag').focus();
});
$('#back-to-bag').addEventListener('click', () => {
  showView($('#bag-view'), '-2rem');
  $('#show-checkout').focus();
});
$('#checkout-view').addEventListener('input', updateOrderLinks);
$('#instagram-checkout').addEventListener('click', () => {
  navigator.clipboard?.writeText(orderMessage()).then(() => showToast('Order copied. Paste it in the chat.'), () => showToast("Couldn't copy your order. Please type it in the chat."));
});

// Share a plan directly: /#netflix, or links from the previous site such as /products/gemini-ai-pro.
const linked = location.pathname.match(/^\/products\/([\w-]+)/)?.[1] ?? location.hash.slice(1);
if (productById.has(linked)) openPlan(linked);

// Count a number up from zero on a critically damped spring, keeping its text format ("Rs. 1,399").
function countUp(element) {
  const text = element.textContent, target = Number(text.replace(/\D/g, ''));
  const counter = spring(value => { element.textContent = text.replace(/[\d,]+/, new Intl.NumberFormat('en-NP').format(Math.round(value))); });
  counter.set(0);
  counter.to(target, { response: 1.2 });
}

if (document.documentElement.classList.contains('js-reveal')) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        entry.target.querySelectorAll('[data-count]').forEach(countUp);
        observer.unobserve(entry.target);
      }
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
}
