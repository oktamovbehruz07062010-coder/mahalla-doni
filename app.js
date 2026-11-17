const $ = (id) => document.getElementById(id);

let products = [];
let category = 'Hammasi';
let query = '';
let cart = loadCart();

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem('cart')) || {};
  } catch {
    return {};
  }
}

function saveCart() {
  try {
    localStorage.setItem('cart', JSON.stringify(cart));
  } catch {}
}

function money(n) {
  return n.toLocaleString('ru-RU') + " so'm";
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}

async function loadProducts() {
  const r = await fetch('/api/products');
  products = await r.json();
  // Savatdagi o'chirilgan mahsulotlarni olib tashlaymiz
  for (const id of Object.keys(cart)) {
    if (!products.some((p) => String(p.id) === id)) delete cart[id];
  }
  saveCart();
  renderFilters();
  renderGrid();
  renderCart();
}

function renderFilters() {
  const cats = ['Hammasi', ...new Set(products.map((p) => p.category))];
  const box = $('filters');
  box.replaceChildren(
    ...cats.map((c) => {
      const b = el('button', { textContent: c, className: c === category ? 'active' : 'ghost' });
      b.onclick = () => {
        category = c;
        renderFilters();
        renderGrid();
      };
      return b;
    })
  );
}

function renderGrid() {
  const q = query.trim().toLowerCase();
  const list = products.filter(
    (p) =>
      (category === 'Hammasi' || p.category === category) &&
      (!q || p.name.toLowerCase().includes(q))
  );
  $('empty').hidden = list.length > 0;
  $('grid').replaceChildren(
    ...list.map((p) => {
      const add = el('button', { textContent: "Savatga qo'shish" });
      add.onclick = () => addToCart(p.id);
      return el('div', { className: 'card' }, [
        el('div', { className: 'cat', textContent: p.category }),
        el('div', { className: 'name', textContent: p.name }),
        el('div', { className: 'price', textContent: money(p.price) + ' / ' + p.unit }),
        add,
      ]);
    })
  );
}

function addToCart(id) {
  cart[id] = Math.min((cart[id] || 0) + 1, 99);
  saveCart();
  renderCart();
}

function changeQty(id, delta) {
  const next = (cart[id] || 0) + delta;
  if (next <= 0) delete cart[id];
  else cart[id] = Math.min(next, 99);
  saveCart();
  renderCart();
}

function cartTotal() {
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find((x) => String(x.id) === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);
}

function renderCart() {
  const entries = Object.entries(cart);
  $('cart-count').textContent = entries.reduce((s, [, q]) => s + q, 0);
  $('cart-total').textContent = money(cartTotal());
  $('submit-btn').disabled = entries.length === 0;

  if (entries.length === 0) {
    $('cart-items').replaceChildren(el('p', { className: 'empty', textContent: "Savat bo'sh" }));
    return;
  }

  $('cart-items').replaceChildren(
    ...entries.map(([id, qty]) => {
      const p = products.find((x) => String(x.id) === id);
      const minus = el('button', { textContent: '-', className: 'ghost' });
      const plus = el('button', { textContent: '+', className: 'ghost' });
      minus.onclick = () => changeQty(id, -1);
      plus.onclick = () => changeQty(id, 1);
      return el('div', { className: 'cart-row' }, [
        el('div', { textContent: p.name }),
        el('div', { className: 'qty' }, [minus, el('span', { textContent: qty }), plus]),
        el('div', { className: 'sub', textContent: money(p.price) + ' x ' + qty }),
        el('div', { className: 'sub', textContent: money(p.price * qty), style: 'text-align:right' }),
      ]);
    })
  );
}

function showMsg(text, ok) {
  $('msg').replaceChildren(el('div', { className: 'msg ' + (ok ? 'ok' : 'err'), textContent: text }));
}

async function submitOrder(e) {
  e.preventDefault();
  const form = e.target;
  const items = Object.entries(cart).map(([id, qty]) => ({ id: Number(id), qty }));
  const body = {
    name: form.name.value,
    phone: form.phone.value,
    address: form.address.value,
    comment: form.comment.value,
    items,
  };

  $('submit-btn').disabled = true;
  try {
    const r = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Xatolik');
    cart = {};
    saveCart();
    renderCart();
    form.reset();
    showMsg('Buyurtma #' + data.orderId + ' qabul qilindi. Jami: ' + money(data.total), true);
  } catch (err) {
    showMsg(err.message, false);
    $('submit-btn').disabled = false;
  }
}

function togglePanel(open) {
  $('panel').classList.toggle('open', open);
  $('overlay').classList.toggle('open', open);
  if (open) $('msg').replaceChildren();
}

$('open-cart').onclick = () => togglePanel(true);
$('close-cart').onclick = () => togglePanel(false);
$('overlay').onclick = () => togglePanel(false);
$('order-form').addEventListener('submit', submitOrder);
$('search').addEventListener('input', (e) => {
  query = e.target.value;
  renderGrid();
});

loadProducts().catch(() => {
  $('empty').hidden = false;
  $('empty').textContent = 'Mahsulotlarni yuklab bo\'lmadi';
});
