const $ = (id) => document.getElementById(id);

let password = sessionStorage.getItem('adminPw') || '';
let products = [];
let editingId = null;

function money(n) {
  return n.toLocaleString('ru-RU') + " so'm";
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}

function showMsg(text, ok) {
  $('msg').replaceChildren(el('div', { className: 'msg ' + (ok ? 'ok' : 'err'), textContent: text }));
  setTimeout(() => $('msg').replaceChildren(), 4000);
}

async function api(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Xatolik');
  return data;
}

async function login(pw) {
  password = pw;
  try {
    await api('GET', '/api/admin/check');
    sessionStorage.setItem('adminPw', pw);
    $('login').hidden = true;
    $('app').hidden = false;
    await loadProducts();
  } catch {
    password = '';
    sessionStorage.removeItem('adminPw');
    $('login').hidden = false;
    $('app').hidden = true;
    if (pw) alert('Parol noto\'g\'ri');
  }
}

async function loadProducts() {
  products = await (await fetch('/api/products')).json();
  renderProducts();
}

function renderProducts() {
  $('product-rows').replaceChildren(
    ...products.map((p) => {
      const edit = el('button', { textContent: 'Tahrirlash', className: 'ghost' });
      const del = el('button', { textContent: "O'chirish", className: 'danger' });
      edit.onclick = () => startEdit(p);
      del.onclick = () => removeProduct(p);
      return el('tr', {}, [
        el('td', { textContent: p.name }),
        el('td', { textContent: money(p.price) }),
        el('td', { textContent: p.unit }),
        el('td', { textContent: p.category }),
        el('td', {}, [el('div', { className: 'row-actions' }, [edit, del])]),
      ]);
    })
  );
}

function startEdit(p) {
  editingId = p.id;
  const f = $('product-form');
  f.name.value = p.name;
  f.price.value = p.price;
  f.unit.value = p.unit;
  f.category.value = p.category;
  $('save-btn').textContent = 'Saqlash';
  $('cancel-edit').hidden = false;
  f.name.focus();
}

function resetForm() {
  editingId = null;
  $('product-form').reset();
  $('save-btn').textContent = "Qo'shish";
  $('cancel-edit').hidden = true;
}

async function removeProduct(p) {
  if (!confirm(p.name + " o'chirilsinmi?")) return;
  try {
    await api('DELETE', '/api/admin/products/' + p.id);
    await loadProducts();
    showMsg("O'chirildi", true);
  } catch (err) {
    showMsg(err.message, false);
  }
}

async function saveProduct(e) {
  e.preventDefault();
  const f = e.target;
  const body = {
    name: f.name.value,
    price: Number(f.price.value),
    unit: f.unit.value || 'dona',
    category: f.category.value || 'Boshqa',
  };
  try {
    if (editingId) await api('PUT', '/api/admin/products/' + editingId, body);
    else await api('POST', '/api/admin/products', body);
    resetForm();
    await loadProducts();
    showMsg('Saqlandi', true);
  } catch (err) {
    showMsg(err.message, false);
  }
}

async function loadOrders() {
  const box = $('view-orders');
  try {
    const orders = await api('GET', '/api/admin/orders');
    if (orders.length === 0) {
      box.replaceChildren(el('p', { className: 'empty', textContent: "Buyurtmalar yo'q" }));
      return;
    }
    box.replaceChildren(
      ...orders.map((o) =>
        el('div', { className: 'order' }, [
          el('h3', { textContent: '#' + o.id + ' | ' + money(o.total) }),
          el('div', {
            className: 'meta',
            textContent: new Date(o.createdAt).toLocaleString('ru-RU') + ' | ' + o.name + ' | ' + o.phone,
          }),
          el('div', { className: 'meta', textContent: 'Manzil: ' + o.address }),
          o.comment ? el('div', { className: 'meta', textContent: 'Izoh: ' + o.comment }) : '',
          el('div', { textContent: o.items.map((i) => i.name + ' x ' + i.qty).join(', '), style: 'margin-top:6px' }),
        ])
      )
    );
  } catch (err) {
    showMsg(err.message, false);
  }
}

function switchTab(name) {
  const isProducts = name === 'products';
  $('view-products').hidden = !isProducts;
  $('view-orders').hidden = isProducts;
  $('tab-products').classList.toggle('active', isProducts);
  $('tab-orders').classList.toggle('active', !isProducts);
  if (!isProducts) loadOrders();
}

$('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  login($('pw').value);
});
$('product-form').addEventListener('submit', saveProduct);
$('cancel-edit').onclick = resetForm;
$('tab-products').onclick = () => switchTab('products');
$('tab-orders').onclick = () => switchTab('orders');
$('logout').onclick = () => {
  sessionStorage.removeItem('adminPw');
  location.reload();
};

if (password) login(password);
