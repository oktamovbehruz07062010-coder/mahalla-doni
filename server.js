// Mahalla do'koni: onlayn buyurtma tizimi
// Faqat Node.js ichki modullari ishlatiladi. npm install kerak emas.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const CHAT_ID = process.env.CHAT_ID || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const PUBLIC_DIR = path.join(__dirname, 'public');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100 * 1024) {
        reject(new Error('Juda katta so\'rov'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON xato'));
      }
    });
    req.on('error', reject);
  });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatPrice(n) {
  return n.toLocaleString('ru-RU').replace(/ /g, ' ') + " so'm";
}

async function sendToTelegram(text) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log('Telegram sozlanmagan. Buyurtma matni:\n' + text.replace(/<[^>]+>/g, ''));
    return false;
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
    });
    if (!r.ok) {
      console.error('Telegram xatosi:', r.status, await r.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Telegramga ulanib bo\'lmadi:', err.message);
    return false;
  }
}

function isAdmin(req) {
  return req.headers['x-admin-password'] === ADMIN_PASSWORD;
}

function validateProduct(p) {
  const name = String(p.name || '').trim();
  const price = Number(p.price);
  const unit = String(p.unit || 'dona').trim();
  const category = String(p.category || 'Boshqa').trim();
  if (!name || name.length > 80) return null;
  if (!Number.isFinite(price) || price <= 0 || price > 100000000) return null;
  return { name, price: Math.round(price), unit: unit.slice(0, 20), category: category.slice(0, 40) };
}

async function handleApi(req, res, url) {
  const method = req.method;

  if (method === 'GET' && url.pathname === '/api/products') {
    return send(res, 200, readJson(PRODUCTS_FILE, []));
  }

  if (method === 'POST' && url.pathname === '/api/order') {
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 60);
    const phone = String(body.phone || '').trim().slice(0, 25);
    const address = String(body.address || '').trim().slice(0, 200);
    const comment = String(body.comment || '').trim().slice(0, 300);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!name || !address || !/^[+\d\s()-]{7,25}$/.test(phone)) {
      return send(res, 400, { error: 'Ism, telefon va manzilni to\'g\'ri kiriting' });
    }
    if (items.length === 0 || items.length > 50) {
      return send(res, 400, { error: 'Savat bo\'sh' });
    }

    // Narxlarni serverdan olamiz. Mijoz yuborgan narxga ishonmaymiz.
    const products = readJson(PRODUCTS_FILE, []);
    const lines = [];
    let total = 0;
    for (const it of items) {
      const product = products.find((p) => p.id === Number(it.id));
      const qty = Math.floor(Number(it.qty));
      if (!product || !Number.isFinite(qty) || qty < 1 || qty > 99) {
        return send(res, 400, { error: 'Savatdagi mahsulot noto\'g\'ri' });
      }
      const sum = product.price * qty;
      total += sum;
      lines.push({ id: product.id, name: product.name, price: product.price, qty, sum });
    }

    const orders = readJson(ORDERS_FILE, []);
    const order = {
      id: orders.length + 1,
      createdAt: new Date().toISOString(),
      name, phone, address, comment, items: lines, total,
    };
    orders.push(order);
    writeJson(ORDERS_FILE, orders);

    const text = [
      `<b>Yangi buyurtma #${order.id}</b>`,
      '',
      ...lines.map((l) => `${escapeHtml(l.name)} x ${l.qty} = ${formatPrice(l.sum)}`),
      '',
      `<b>Jami: ${formatPrice(total)}</b>`,
      '',
      `Ism: ${escapeHtml(name)}`,
      `Telefon: ${escapeHtml(phone)}`,
      `Manzil: ${escapeHtml(address)}`,
      comment ? `Izoh: ${escapeHtml(comment)}` : '',
    ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');

    const sent = await sendToTelegram(text);
    return send(res, 201, { ok: true, orderId: order.id, total, telegram: sent });
  }

  // Admin yo'llari
  if (url.pathname.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 401, { error: 'Parol noto\'g\'ri' });

    if (method === 'GET' && url.pathname === '/api/admin/check') {
      return send(res, 200, { ok: true });
    }

    if (method === 'GET' && url.pathname === '/api/admin/orders') {
      return send(res, 200, readJson(ORDERS_FILE, []).slice().reverse());
    }

    if (method === 'POST' && url.pathname === '/api/admin/products') {
      const data = validateProduct(await readBody(req));
      if (!data) return send(res, 400, { error: 'Mahsulot ma\'lumoti noto\'g\'ri' });
      const products = readJson(PRODUCTS_FILE, []);
      const id = products.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      const product = { id, ...data };
      products.push(product);
      writeJson(PRODUCTS_FILE, products);
      return send(res, 201, product);
    }

    const match = url.pathname.match(/^\/api\/admin\/products\/(\d+)$/);
    if (match) {
      const id = Number(match[1]);
      const products = readJson(PRODUCTS_FILE, []);
      const index = products.findIndex((p) => p.id === id);
      if (index === -1) return send(res, 404, { error: 'Mahsulot topilmadi' });

      if (method === 'PUT') {
        const data = validateProduct(await readBody(req));
        if (!data) return send(res, 400, { error: 'Mahsulot ma\'lumoti noto\'g\'ri' });
        products[index] = { id, ...data };
        writeJson(PRODUCTS_FILE, products);
        return send(res, 200, products[index]);
      }
      if (method === 'DELETE') {
        products.splice(index, 1);
        writeJson(PRODUCTS_FILE, products);
        return send(res, 200, { ok: true });
      }
    }
  }

  return send(res, 404, { error: 'Topilmadi' });
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin') pathname = '/admin.html';

  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Taqiqlangan');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Sahifa topilmadi');
    }
    const type = MIME[path.extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      serveStatic(req, res, url);
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 400, { error: err.message || 'Xatolik' });
  }
});

server.listen(PORT, () => {
  console.log(`Server ishga tushdi: http://localhost:${PORT}`);
  console.log(`Admin sahifa: http://localhost:${PORT}/admin`);
  if (!BOT_TOKEN || !CHAT_ID) console.log('Ogohlantirish: BOT_TOKEN va CHAT_ID berilmagan. Buyurtmalar faqat orders.json ga yoziladi.');
  if (ADMIN_PASSWORD === 'admin123') console.log('Ogohlantirish: ADMIN_PASSWORD o\'zgartiring.');
});
