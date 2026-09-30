import { config } from './config.js';

const productById = new Map(config.products.map(product => [product.id, product]));
const formatPrice = value => `Rs. ${new Intl.NumberFormat('en-NP').format(value)}`;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const cartKey = 'screentime-nepal-cart';
const logos = { netflix: 'netflix.svg', prime: 'prime-video.svg', spotify: 'spotify.svg', claude: 'claude.svg' };
const $ = selector => document.querySelector(selector);

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(cartKey));
    if (!Array.isArray(saved)) return [];
    return saved.filter(item => productById.has(item.id)
      && Object.hasOwn(productById.get(item.id).prices, item.months)
      && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 20)
      .map(({ id, months, quantity }) => ({ id, months: Number(months), quantity }));
  } catch {
    return [];
  }
}

let cart = readCart();
let selectedProduct;
let selectedMonths = 1;
let priceFrame;
let toastTimer;

function saveCart() {
  try { localStorage.setItem(cartKey, JSON.stringify(cart)); } catch { /* Storage may be disabled. */ }
  renderCart();
}

function total() {
  return cart.reduce((sum, item) => sum + productById.get(item.id).prices[item.months] * item.quantity, 0);
}

function logo(product) {
  return `<img src="assets/${logos[product.id]}" alt="" loading="lazy">`;
}

function renderProducts() {
  $('#product-grid').innerHTML = config.products.map((product, index) => `
    <article class="product-card reveal">
      <div class="product-art ${product.id}"><span class="art-index">0${index + 1} / 0${config.products.length}</span>${logo(product)}<span class="art-spark" aria-hidden="true">✳</span></div>
      <div class="product-body"><span class="product-category">${product.category}</span><h3>${product.name}</h3><p>${product.line}</p>
        <div class="product-bottom"><div><small>From / month</small><strong>${formatPrice(product.prices[1])}</strong></div><button type="button" data-product="${product.id}" aria-label="View ${product.name} plans">↗</button></div>
      </div>
    </article>`).join('');
}

function animatePrice(next) {
  const element = $('#plan-price');
  cancelAnimationFrame(priceFrame);
  const start = Number(element.dataset.value) || next;
  element.dataset.value = next;
  if (reducedMotion.matches || start === next) { element.textContent = formatPrice(next); return; }
  const started = performance.now();
  function tick(now) {
    const progress = Math.min((now - started) / 320, 1);
    element.textContent = formatPrice(Math.round(start + (next - start) * (1 - (1 - progress) ** 3)));
    if (progress < 1) priceFrame = requestAnimationFrame(tick);
  }
  priceFrame = requestAnimationFrame(tick);
}

function chooseDuration(months) {
  selectedMonths = months;
  document.querySelectorAll('#duration-options button').forEach(button => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.months) === months));
  });
  animatePrice(selectedProduct.prices[months]);
  $('#plan-monthly').textContent = `${formatPrice(Math.round(selectedProduct.prices[months] / months))} / mo`;
}

function openPlan(id) {
  selectedProduct = productById.get(id);
  if (!selectedProduct) return;
  $('#plan-title').textContent = selectedProduct.name;
  $('#plan-line').textContent = selectedProduct.line;
  $('#plan-visual').className = `plan-visual ${id}`;
  $('#plan-visual').innerHTML = logo(selectedProduct);
  $('#duration-options').innerHTML = [1, 2, 3].map(months => `
    <button type="button" data-months="${months}" aria-pressed="false">${months} ${months === 1 ? 'month' : 'months'}<small>${months === 1 ? 'Just try it' : months === 2 ? 'Keep it going' : 'More to love'}</small></button>`).join('');
  $('#plan-price').dataset.value = selectedProduct.prices[1];
  chooseDuration(1);
  $('#plan-dialog').showModal();
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
}

function renderCart() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  $('#cart-count').textContent = count;
  $('#open-cart').setAttribute('aria-label', `Open bag, ${count} ${count === 1 ? 'item' : 'items'}`);
  $('#cart-total').textContent = formatPrice(total());
  $('#checkout-total').textContent = formatPrice(total());
  $('#show-checkout').disabled = !cart.length;
  $('#cart-items').innerHTML = cart.length ? cart.map((item, index) => {
    const product = productById.get(item.id);
    return `<div class="cart-item"><div class="cart-item-art ${product.id}">${logo(product)}</div><div class="cart-item-info"><h3>${product.name}</h3><p>${item.months} ${item.months === 1 ? 'month' : 'months'} plan</p><div class="cart-item-controls"><button type="button" data-action="decrease" data-index="${index}" aria-label="Decrease ${product.name} quantity">−</button><span>${item.quantity}</span><button type="button" data-action="increase" data-index="${index}" aria-label="Increase ${product.name} quantity" ${item.quantity >= 20 ? 'disabled' : ''}>+</button></div></div><div class="cart-item-price"><button type="button" data-action="remove" data-index="${index}" aria-label="Remove ${product.name}">Remove</button><span>${formatPrice(product.prices[item.months] * item.quantity)}</span></div></div>`;
  }).join('') : `<div class="empty-bag"><span aria-hidden="true">✳</span><h3>Nothing in here yet.</h3><p>Good things start with a great plan. Go find yours.</p><button type="button" id="empty-shop">Explore plans ↗</button></div>`;
  updateWhatsAppLink();
}

function updateWhatsAppLink() {
  const number = String(config.whatsappNumber).replace(/\D/g, '');
  const hasNumber = /^\d{10,15}$/.test(number);
  const payment = document.querySelector('input[name="payment"]:checked')?.value || 'eSewa';
  const name = $('#customer-name').value.trim();
  const lines = cart.map(item => {
    const product = productById.get(item.id);
    return `• ${product.name} — ${item.months} ${item.months === 1 ? 'month' : 'months'} × ${item.quantity}: ${formatPrice(product.prices[item.months] * item.quantity)}`;
  });
  const message = `Hi ScreenTime Nepal! I'd like to order:\n\n${lines.join('\n')}\n\nEstimated total: ${formatPrice(total())}\nPreferred payment: ${payment}${name ? `\nName: ${name}` : ''}\n\nPlease confirm availability, plan details and verified payment instructions before I pay.`;
  $('#whatsapp-checkout').href = `https://wa.me/${hasNumber ? number : ''}?text=${encodeURIComponent(message)}`;
  $('#footer-whatsapp').href = `https://wa.me/${hasNumber ? number : ''}?text=${encodeURIComponent('Hi ScreenTime Nepal! I have a question about your plans.')}`;
  $('#footer-whatsapp').textContent = hasNumber ? 'WhatsApp us ↗' : 'Share on WhatsApp ↗';
  $('#unconfigured-note').hidden = hasNumber;
}

function openCart() {
  $('#checkout-view').hidden = true;
  $('#bag-view').hidden = false;
  $('#cart-dialog').showModal();
}

renderProducts();
renderCart();
$('#year').textContent = new Date().getFullYear();
if (config.instagramUrl && /^https:\/\//.test(config.instagramUrl)) {
  $('#footer-instagram').href = config.instagramUrl;
  $('#footer-instagram').hidden = false;
}

$('#product-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-product]');
  if (button) openPlan(button.dataset.product);
});
$('#duration-options').addEventListener('click', event => {
  const button = event.target.closest('[data-months]');
  if (button) chooseDuration(Number(button.dataset.months));
});
$('#add-to-cart').addEventListener('click', () => {
  const existing = cart.find(item => item.id === selectedProduct.id && item.months === selectedMonths);
  if (existing) existing.quantity = Math.min(20, existing.quantity + 1);
  else cart.push({ id: selectedProduct.id, months: selectedMonths, quantity: 1 });
  saveCart();
  $('#plan-dialog').close();
  openCart();
  showToast('Added to your bag');
});
$('#open-cart').addEventListener('click', openCart);
$('#cart-items').addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (button) {
    const index = Number(button.dataset.index);
    if (button.dataset.action === 'remove' || (button.dataset.action === 'decrease' && cart[index].quantity === 1)) cart.splice(index, 1);
    else cart[index].quantity = Math.max(1, Math.min(20, cart[index].quantity + (button.dataset.action === 'increase' ? 1 : -1)));
    saveCart();
  }
  if (event.target.closest('#empty-shop')) {
    $('#cart-dialog').close();
    $('#plans').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }
});
$('#show-checkout').addEventListener('click', () => {
  if (!cart.length) return;
  $('#bag-view').hidden = true;
  $('#checkout-view').hidden = false;
  $('#back-to-bag').focus();
});
$('#back-to-bag').addEventListener('click', () => {
  $('#checkout-view').hidden = true;
  $('#bag-view').hidden = false;
  $('#show-checkout').focus();
});
$('#customer-name').addEventListener('input', updateWhatsAppLink);
document.querySelectorAll('input[name="payment"]').forEach(input => input.addEventListener('change', updateWhatsAppLink));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
});

if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } });
  }, { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
} else document.querySelectorAll('.reveal').forEach(element => element.classList.add('visible'));
