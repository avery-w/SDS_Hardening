const $ = (selector) => document.querySelector(selector);
const toast = (message) => {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
};
const api = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: {'Content-Type': 'application/json', ...(options.headers || {})},
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
};
const auth = $('#auth-dialog');

const appendText = (parent, tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
};

const bindAddCart = (button) => button.addEventListener('click', async () => {
  if (!requireLogin()) return;
  try {
    await api('/api/cart', {
      method: 'POST',
      body: JSON.stringify({product_id: button.dataset.id, quantity: 1}),
    });
    toast('Added to your cart.');
  } catch (error) {
    toast(error.message);
  }
});

const requireLogin = () => {
  if (!window.isLoggedIn) {
    auth.showModal();
    return false;
  }
  return true;
};

const safeImageUrl = (value) => {
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : '';
  } catch {
    return '';
  }
};

const createProductCard = (product) => {
  const card = document.createElement('article');
  card.className = 'product-card';
  const image = document.createElement('div');
  image.className = 'product-image';
  const imageUrl = safeImageUrl(product.image_url);
  if (imageUrl) image.style.backgroundImage = `url("${imageUrl}")`;
  appendText(image, 'span', 'category', product.category);
  card.append(image);

  const info = document.createElement('div');
  info.className = 'product-info';
  const details = document.createElement('div');
  appendText(details, 'h3', '', product.name);
  appendText(details, 'p', '', product.store_name);
  info.append(details);
  appendText(info, 'strong', '', `$${Number(product.price).toFixed(2)}`);
  card.append(info);
  appendText(card, 'p', 'product-description', product.description);
  const button = appendText(card, 'button', 'button button-dark add-cart', 'Add to cart');
  button.dataset.id = product.id;
  button.type = 'button';
  bindAddCart(button);
  return card;
};

const appendChatMessage = (text, className) => {
  const log = $('#chat-log');
  if (!log) return;
  appendText(log, 'div', `chat-bubble ${className}`, text);
  log.scrollTop = log.scrollHeight;
};

$('[data-open-auth]')?.addEventListener('click', () => auth.showModal());
$('[data-close-auth]')?.addEventListener('click', () => auth.close());
$('[data-logout]')?.addEventListener('click', async () => {
  await api('/api/auth/logout', {method: 'POST'});
  location.href = '/';
});
$('#login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  try {
    await api('/api/auth/login', {method: 'POST', body: JSON.stringify(Object.fromEntries(form))});
    location.href = '/dashboard';
  } catch (error) {
    toast(error.message);
  }
});

document.querySelectorAll('.add-cart').forEach(bindAddCart);

const search = $('#search');
search?.addEventListener('input', async () => {
  try {
    const data = await api(`/api/products?q=${encodeURIComponent(search.value)}`);
    const grid = $('#product-grid');
    grid.replaceChildren(...data.products.map(createProductCard));
  } catch (error) {
    toast(error.message);
  }
});

const chat = $('#chat-dialog');
document.querySelectorAll('[data-chat-open]').forEach((button) => button.addEventListener('click', () => {
  if (requireLogin()) chat.showModal();
}));
$('[data-chat-close]')?.addEventListener('click', () => chat.close());
$('#chat-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = event.target.message;
  const text = input.value;
  input.value = '';
  appendChatMessage(text, 'user-bubble');
  try {
    const data = await api('/api/chat', {method: 'POST', body: JSON.stringify({message: text})});
    appendChatMessage(data.answer, 'bot');
  } catch (error) {
    toast(error.message);
  }
});

const loadOrders = async () => {
  const list = $('#orders');
  if (!list) return;
  try {
    const data = await api('/api/orders');
    list.replaceChildren();
    if (!data.orders.length) {
      appendText(list, 'p', 'muted', 'No orders yet. Your next good find is waiting.');
      return;
    }
    data.orders.forEach((order) => {
      const row = document.createElement('div');
      row.className = 'order';
      const details = document.createElement('div');
      appendText(details, 'strong', '', `Order #${order.id}`);
      details.append(document.createElement('br'));
      appendText(details, 'span', 'muted', order.created_at);
      row.append(details);
      const status = document.createElement('div');
      appendText(status, 'span', 'status', order.status);
      status.append(document.createElement('br'));
      appendText(status, 'strong', '', `$${Number(order.total).toFixed(2)}`);
      row.append(status);
      list.append(row);
    });
  } catch (error) {
    list.textContent = error.message;
  }
};

const loadAdmin = async () => {
  const metrics = $('#metrics');
  if (!metrics) return;
  try {
    const {summary} = await api('/api/admin/summary');
    metrics.replaceChildren();
    [
      ['Users', summary.users],
      ['Active sellers', summary.active_sellers],
      ['Products', summary.products],
      ['Revenue', `$${Number(summary.revenue).toFixed(2)}`],
    ].forEach(([label, value]) => {
      const metric = document.createElement('div');
      metric.className = 'metric';
      appendText(metric, 'span', '', label);
      appendText(metric, 'strong', '', value);
      metrics.append(metric);
    });
  } catch (error) {
    toast(error.message);
  }
};

$('[data-add-product]')?.addEventListener('click', () => $('#product-dialog').showModal());
$('[data-close-product]')?.addEventListener('click', () => $('#product-dialog').close());
$('#product-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  try {
    await api('/api/seller/products', {method: 'POST', body: JSON.stringify(data)});
    toast('Product published.');
    $('#product-dialog').close();
    event.target.reset();
  } catch (error) {
    toast(error.message);
  }
});

window.isLoggedIn = Boolean(document.querySelector('[data-logout]'));
loadOrders();
loadAdmin();
