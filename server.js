/**
 * MULTIVISION ELECTRONICS & INVESTMENTS
 * Private Shop Management System + Public API (Node.js + Express + JSON storage)
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { read, write, id } = require('./store');

// ensure data exists on first boot (Render fresh deploy)
try { require('./scripts/seed.js'); } catch (e) { console.error('seed error', e.message); }

const app = express();
const PORT = process.env.PORT || 4000;

const UPLOADS = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, f, cb) => cb(null, UPLOADS),
    filename: (req, f, cb) => cb(null, Date.now() + '-' + f.originalname.replace(/[^\w.\-]/g, '_')),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* ------------------------------ AUTH ------------------------------ */
const sessions = new Map(); // token -> {userId, role, name, username, exp}

function verifyPassword(pw, stored) {
  const [salt, key] = String(stored).split(':');
  if (!salt || !key) return false;
  const h = crypto.scryptSync(pw, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(key));
}
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const s = sessions.get(token);
  if (!s || s.exp < Date.now()) return res.status(401).json({ error: 'Not authorised. Please log in.' });
  req.user = s;
  next();
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access only' });
  next();
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = read('users').find((u) => u.username === String(username || '').toLowerCase().trim() && u.active !== false);
  if (!user || !verifyPassword(String(password || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  const session = { userId: user.id, role: user.role, name: user.name, username: user.username, branchId: user.branchId, exp: Date.now() + 12 * 3600 * 1000 };
  sessions.set(token, session);
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, username: user.username, branchId: user.branchId } });
});
app.post('/api/auth/logout', auth, (req, res) => { res.json({ ok: true }); });
app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

/* --------------------------- PUBLIC API --------------------------- */
function publicProduct(p) {
  return {
    id: p.id, name: p.name, category: p.category, description: p.description,
    specifications: p.specifications, price: p.price, priceMax: p.priceMax || 0,
    availability: totalStock(p) > 0 && p.available !== false ? 'In Stock' : 'Out of Stock',
    image: p.image || '', branches: branchNamesFor(p),
  };
}
function totalStock(p) { return Object.values(p.stock || {}).reduce((a, b) => a + Number(b || 0), 0); }
function productProfit(p) { return Number(p.price || 0) - Number(p.purchasePrice || 0); }
function productStockSummary(p) {
  const stock = totalStock(p);
  return { stock, stockCost: stock * Number(p.purchasePrice || 0), expectedProfit: stock * productProfit(p) };
}
function branchNamesFor(p) {
  const branches = read('branches');
  return branches.filter((b) => Number((p.stock || {})[b.id] || 0) > 0).map((b) => b.name);
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'multivision-management-system', time: new Date().toISOString() }));

app.get('/api/products', (req, res) => {
  const { category, q } = req.query;
  let list = read('products').filter((p) => p.visible !== false);
  if (category) list = list.filter((p) => p.category === category);
  if (q) {
    const s = String(q).toLowerCase();
    list = list.filter((p) => (p.name + ' ' + p.category + ' ' + (p.specifications || '')).toLowerCase().includes(s));
  }
  res.json(list.map(publicProduct));
});
app.get('/api/products/:pid', (req, res) => {
  const p = read('products').find((x) => x.id === req.params.pid && x.visible !== false);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(publicProduct(p));
});
app.get('/api/categories', (req, res) => res.json(read('categories')));
app.get('/api/branches', (req, res) => res.json(read('branches').map((b) => ({ id: b.id, name: b.name, town: b.town, address: b.address, phone: b.phone }))));
app.get('/api/settings/public', (req, res) => {
  const s = read('settings', {});
  res.json({ businessName: s.businessName, phone: s.phone, whatsapp: s.whatsapp, currency: s.currency });
});

/* ------------------------- ADMIN: PRODUCTS ------------------------- */
app.get('/api/admin/products', auth, (req, res) => res.json(read('products')));

app.post('/api/admin/products', auth, upload.single('image'), (req, res) => {
  const b = req.body;
  const products = read('products');
  const stock = {};
  read('branches').forEach((br) => { stock[br.id] = Number(b['stock_' + br.id] || 0); });
  const p = {
    id: id('p'),
    sku: b.sku || 'SKU-' + (products.length + 1),
    name: b.name, category: b.category,
    description: b.description || '', specifications: b.specifications || '',
    price: Number(b.price || 0), priceMax: Number(b.priceMax || 0),
    purchasePrice: Number(b.purchasePrice || 0),
    stock, lowStockLevel: Number(b.lowStockLevel || 2),
    supplierId: b.supplierId || '',
    image: req.file ? '/uploads/' + req.file.filename : (b.image || ''),
    available: b.available !== 'false', visible: b.visible !== 'false',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  products.push(p);
  write('products', products);
  res.json(p);
});

app.put('/api/admin/products/:pid', auth, upload.single('image'), (req, res) => {
  const products = read('products');
  const p = products.find((x) => x.id === req.params.pid);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const b = req.body;
  ['name', 'category', 'description', 'specifications', 'sku', 'supplierId'].forEach((k) => { if (b[k] !== undefined) p[k] = b[k]; });
  ['price', 'priceMax', 'purchasePrice', 'lowStockLevel'].forEach((k) => { if (b[k] !== undefined) p[k] = Number(b[k]); });
  read('branches').forEach((br) => { if (b['stock_' + br.id] !== undefined) p.stock[br.id] = Number(b['stock_' + br.id]); });
  if (b.available !== undefined) p.available = b.available !== 'false' && b.available !== false;
  if (b.visible !== undefined) p.visible = b.visible !== 'false' && b.visible !== false;
  if (req.file) p.image = '/uploads/' + req.file.filename;
  if (b.removeImage === 'true') p.image = '';
  p.updatedAt = new Date().toISOString();
  write('products', products);
  res.json(p);
});

app.delete('/api/admin/products/:pid/image', auth, (req, res) => {
  const products = read('products');
  const p = products.find((x) => x.id === req.params.pid);
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.image = '';
  write('products', products);
  res.json(p);
});

app.delete('/api/admin/products/:pid', auth, adminOnly, (req, res) => {
  write('products', read('products').filter((x) => x.id !== req.params.pid));
  res.json({ ok: true });
});

/* --------------------------- INVENTORY ---------------------------- */
app.post('/api/admin/stock', auth, (req, res) => {
  const { productId, branchId, type, quantity, note, toBranchId } = req.body || {};
  const products = read('products');
  const p = products.find((x) => x.id === productId);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const qty = Number(quantity || 0);
  p.stock = p.stock || {};
  const cur = Number(p.stock[branchId] || 0);
  if (type === 'add') p.stock[branchId] = cur + qty;
  else if (type === 'remove') p.stock[branchId] = Math.max(0, cur - qty);
  else if (type === 'adjust') p.stock[branchId] = qty;
  else if (type === 'transfer') {
    if (cur < qty) return res.status(400).json({ error: 'Not enough stock to transfer' });
    p.stock[branchId] = cur - qty;
    p.stock[toBranchId] = Number(p.stock[toBranchId] || 0) + qty;
  }
  p.updatedAt = new Date().toISOString();
  write('products', products);
  const moves = read('stockmoves');
  moves.unshift({ id: id('sm'), productId, productName: p.name, branchId, toBranchId: toBranchId || '', type, quantity: qty, note: note || '', user: req.user.name, date: new Date().toISOString() });
  write('stockmoves', moves);
  res.json(p);
});
app.get('/api/admin/stockmoves', auth, (req, res) => res.json(read('stockmoves').slice(0, 200)));

/* ----------------------------- SALES ------------------------------ */
app.get('/api/admin/sales', auth, (req, res) => res.json(read('sales')));

app.post('/api/admin/sales', auth, (req, res) => {
  const b = req.body || {};
  const products = read('products');
  const items = (b.items || []).map((it) => {
    const p = products.find((x) => x.id === it.productId);
    const qty = Number(it.quantity || 1);
    const price = Number(it.price != null ? it.price : (p ? p.price : 0));
    if (p) { p.stock[b.branchId] = Math.max(0, Number(p.stock[b.branchId] || 0) - qty); p.updatedAt = new Date().toISOString(); }
    return { productId: it.productId, name: p ? p.name : it.name || 'Item', category: p ? p.category : '', quantity: qty, price, cost: p ? Number(p.purchasePrice || 0) : 0, total: qty * price };
  });
  write('products', products);
  const subtotal = items.reduce((a, i) => a + i.total, 0);
  const discount = Number(b.discount || 0);
  const total = Math.max(0, subtotal - discount);
  const cost = items.reduce((a, i) => a + i.cost * i.quantity, 0);
  const sale = {
    id: id('s'), receiptNo: 'MV' + Date.now().toString().slice(-8),
    items, subtotal, discount, total, cost, profit: total - cost,
    customerId: b.customerId || '', customerName: b.customerName || 'Walk-in Customer',
    paymentMethod: b.paymentMethod || 'Cash', branchId: b.branchId,
    staffId: req.user.userId, staffName: req.user.name,
    date: b.date || new Date().toISOString(), notes: b.notes || '',
  };
  const sales = read('sales'); sales.unshift(sale); write('sales', sales);

  if (sale.customerId) {
    const customers = read('customers');
    const c = customers.find((x) => x.id === sale.customerId);
    if (c) { c.totalSpent = Number(c.totalSpent || 0) + total; write('customers', customers); }
  }
  res.json(sale);
});
app.delete('/api/admin/sales/:sid', auth, adminOnly, (req, res) => {
  write('sales', read('sales').filter((s) => s.id !== req.params.sid));
  res.json({ ok: true });
});

/* --------------------------- EXPENSES ----------------------------- */
app.get('/api/admin/expenses', auth, (req, res) => res.json(read('expenses')));
app.post('/api/admin/expenses', auth, (req, res) => {
  const b = req.body || {};
  const e = { id: id('e'), title: b.title, category: b.category || 'General', amount: Number(b.amount || 0), description: b.description || '', branchId: b.branchId || '', date: b.date || new Date().toISOString(), staffName: req.user.name };
  const list = read('expenses'); list.unshift(e); write('expenses', list);
  res.json(e);
});
app.delete('/api/admin/expenses/:eid', auth, adminOnly, (req, res) => {
  write('expenses', read('expenses').filter((x) => x.id !== req.params.eid));
  res.json({ ok: true });
});

/* --------------------------- CUSTOMERS ---------------------------- */
app.get('/api/admin/customers', auth, (req, res) => {
  const sales = read('sales');
  res.json(read('customers').map((c) => ({
    ...c,
    purchases: sales.filter((s) => s.customerId === c.id).length,
    totalSpent: sales.filter((s) => s.customerId === c.id).reduce((a, s) => a + s.total, 0),
  })));
});
app.post('/api/admin/customers', auth, (req, res) => {
  const b = req.body || {};
  const c = { id: id('c'), name: b.name, phone: b.phone || '', whatsapp: b.whatsapp || b.phone || '', address: b.address || '', outstanding: Number(b.outstanding || 0), totalSpent: 0, createdAt: new Date().toISOString() };
  const list = read('customers'); list.unshift(c); write('customers', list); res.json(c);
});
app.put('/api/admin/customers/:cid', auth, (req, res) => {
  const list = read('customers'); const c = list.find((x) => x.id === req.params.cid);
  if (!c) return res.status(404).json({ error: 'Not found' });
  Object.assign(c, { name: req.body.name ?? c.name, phone: req.body.phone ?? c.phone, whatsapp: req.body.whatsapp ?? c.whatsapp, address: req.body.address ?? c.address, outstanding: Number(req.body.outstanding ?? c.outstanding) });
  write('customers', list); res.json(c);
});
app.delete('/api/admin/customers/:cid', auth, adminOnly, (req, res) => {
  write('customers', read('customers').filter((x) => x.id !== req.params.cid)); res.json({ ok: true });
});
app.get('/api/admin/customers/:cid/history', auth, (req, res) => {
  res.json(read('sales').filter((s) => s.customerId === req.params.cid));
});

/* --------------------------- SUPPLIERS ---------------------------- */
app.get('/api/admin/suppliers', auth, (req, res) => res.json(read('suppliers')));
app.post('/api/admin/suppliers', auth, (req, res) => {
  const b = req.body || {};
  const s = { id: id('sup'), name: b.name, phone: b.phone || '', products: b.products || '', amountOwed: Number(b.amountOwed || 0), purchases: [], createdAt: new Date().toISOString() };
  const list = read('suppliers'); list.unshift(s); write('suppliers', list); res.json(s);
});
app.put('/api/admin/suppliers/:sid', auth, (req, res) => {
  const list = read('suppliers'); const s = list.find((x) => x.id === req.params.sid);
  if (!s) return res.status(404).json({ error: 'Not found' });
  Object.assign(s, { name: req.body.name ?? s.name, phone: req.body.phone ?? s.phone, products: req.body.products ?? s.products, amountOwed: Number(req.body.amountOwed ?? s.amountOwed) });
  write('suppliers', list); res.json(s);
});
app.post('/api/admin/suppliers/:sid/purchases', auth, (req, res) => {
  const list = read('suppliers'); const s = list.find((x) => x.id === req.params.sid);
  if (!s) return res.status(404).json({ error: 'Not found' });
  const rec = { id: id('pu'), item: req.body.item, amount: Number(req.body.amount || 0), paid: Number(req.body.paid || 0), date: new Date().toISOString() };
  s.purchases = s.purchases || []; s.purchases.unshift(rec);
  s.amountOwed = Number(s.amountOwed || 0) + (rec.amount - rec.paid);
  write('suppliers', list); res.json(s);
});
app.delete('/api/admin/suppliers/:sid', auth, adminOnly, (req, res) => {
  write('suppliers', read('suppliers').filter((x) => x.id !== req.params.sid)); res.json({ ok: true });
});

/* ----------------------------- LAY-BY ----------------------------- */
function recalcLayby(l) {
  l.totalPaid = (l.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0);
  l.balance = Math.max(0, Number(l.agreedPrice) - l.totalPaid);
  l.status = l.balance === 0 ? 'Completed' : (l.status === 'Cancelled' ? 'Cancelled' : 'Pending');
  return l;
}
app.get('/api/admin/laybys', auth, (req, res) => res.json(read('laybys').map(recalcLayby)));
app.post('/api/admin/laybys', auth, (req, res) => {
  const b = req.body || {};
  const l = recalcLayby({
    id: id('l'), receiptNo: 'LB' + Date.now().toString().slice(-8),
    customerName: b.customerName, phone: b.phone || '',
    productId: b.productId || '', productName: b.productName || '',
    agreedPrice: Number(b.agreedPrice || 0),
    payments: Number(b.initialPayment) > 0 ? [{ id: id('pay'), amount: Number(b.initialPayment), method: b.paymentMethod || 'Cash', receiptNo: 'PR' + Date.now().toString().slice(-8), date: new Date().toISOString(), staffName: req.user.name }] : [],
    branchId: b.branchId || '', notes: b.notes || '', status: 'Pending',
    dateStarted: new Date().toISOString(),
  });
  const list = read('laybys'); list.unshift(l); write('laybys', list); res.json(l);
});
app.post('/api/admin/laybys/:lid/payments', auth, (req, res) => {
  const list = read('laybys'); const l = list.find((x) => x.id === req.params.lid);
  if (!l) return res.status(404).json({ error: 'Not found' });
  const pay = { id: id('pay'), amount: Number(req.body.amount || 0), method: req.body.method || 'Cash', receiptNo: 'PR' + Date.now().toString().slice(-8), date: new Date().toISOString(), staffName: req.user.name };
  l.payments = l.payments || []; l.payments.push(pay);
  recalcLayby(l); write('laybys', list);
  res.json({ layby: l, payment: pay });
});
app.put('/api/admin/laybys/:lid', auth, (req, res) => {
  const list = read('laybys'); const l = list.find((x) => x.id === req.params.lid);
  if (!l) return res.status(404).json({ error: 'Not found' });
  if (req.body.notes !== undefined) l.notes = req.body.notes;
  if (req.body.productName !== undefined) l.productName = req.body.productName; // swap item, price stays fixed
  if (req.body.status !== undefined) l.status = req.body.status;
  recalcLayby(l); write('laybys', list); res.json(l);
});
app.delete('/api/admin/laybys/:lid', auth, adminOnly, (req, res) => {
  write('laybys', read('laybys').filter((x) => x.id !== req.params.lid)); res.json({ ok: true });
});

/* ---------------------------- BRANCHES ---------------------------- */
app.get('/api/admin/branches', auth, (req, res) => res.json(read('branches')));
app.post('/api/admin/branches', auth, adminOnly, (req, res) => {
  const b = req.body || {};
  const br = { id: id('br'), name: b.name, town: b.town || '', address: b.address || '', phone: b.phone || '' };
  const list = read('branches'); list.push(br); write('branches', list); res.json(br);
});
app.put('/api/admin/branches/:bid', auth, adminOnly, (req, res) => {
  const list = read('branches'); const br = list.find((x) => x.id === req.params.bid);
  if (!br) return res.status(404).json({ error: 'Not found' });
  Object.assign(br, { name: req.body.name ?? br.name, town: req.body.town ?? br.town, address: req.body.address ?? br.address, phone: req.body.phone ?? br.phone });
  write('branches', list); res.json(br);
});

/* ------------------------------ USERS ----------------------------- */
app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  res.json(read('users').map((u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, branchId: u.branchId, active: u.active })));
});
app.post('/api/admin/users', auth, adminOnly, (req, res) => {
  const b = req.body || {};
  const users = read('users');
  if (users.some((u) => u.username === String(b.username).toLowerCase())) return res.status(400).json({ error: 'Username already exists' });
  const u = { id: id('u'), username: String(b.username).toLowerCase(), name: b.name, role: b.role === 'admin' ? 'admin' : 'staff', branchId: b.branchId || '', passwordHash: hashPassword(b.password || 'changeme'), active: true };
  users.push(u); write('users', users);
  res.json({ id: u.id, username: u.username, name: u.name, role: u.role });
});
app.put('/api/admin/users/:uid', auth, adminOnly, (req, res) => {
  const users = read('users'); const u = users.find((x) => x.id === req.params.uid);
  if (!u) return res.status(404).json({ error: 'Not found' });
  if (req.body.name) u.name = req.body.name;
  if (req.body.role) u.role = req.body.role;
  if (req.body.branchId !== undefined) u.branchId = req.body.branchId;
  if (req.body.active !== undefined) u.active = !!req.body.active;
  if (req.body.password) u.passwordHash = hashPassword(req.body.password);
  write('users', users); res.json({ ok: true });
});
app.delete('/api/admin/users/:uid', auth, adminOnly, (req, res) => {
  write('users', read('users').filter((x) => x.id !== req.params.uid)); res.json({ ok: true });
});

/* ---------------------------- SETTINGS ---------------------------- */
app.get('/api/admin/settings', auth, (req, res) => res.json(read('settings', {})));
app.put('/api/admin/settings', auth, adminOnly, (req, res) => res.json(write('settings', { ...read('settings', {}), ...req.body })));
app.get('/api/admin/categories', auth, (req, res) => res.json(read('categories')));
app.post('/api/admin/categories', auth, adminOnly, (req, res) => {
  const list = read('categories');
  if (req.body.name && !list.includes(req.body.name)) list.push(req.body.name);
  write('categories', list); res.json(list);
});

/* --------------------------- DASHBOARD ---------------------------- */
function inRange(dateStr, from, to) {
  const d = new Date(dateStr).getTime();
  return d >= from && d <= to;
}
app.get('/api/admin/dashboard', auth, (req, res) => {
  const sales = read('sales'), expenses = read('expenses'), products = read('products'), laybys = read('laybys').map(recalcLayby);
  const now = new Date();
  const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = Date.now();
  const sum = (arr, k) => arr.reduce((a, x) => a + Number(x[k] || 0), 0);
  const todaySales = sales.filter((s) => inRange(s.date, startDay, end));
  const monthSales = sales.filter((s) => inRange(s.date, startMonth, end));
  const monthExp = expenses.filter((e) => inRange(e.date, startMonth, end));
  const low = products.filter((p) => { const t = totalStock(p); return t > 0 && t <= Number(p.lowStockLevel || 2); });
  const out = products.filter((p) => totalStock(p) === 0);
  const stockSummary = products.reduce((a, p) => {
    const summary = productStockSummary(p);
    a.units += summary.stock;
    a.cost += summary.stockCost;
    a.expectedProfit += summary.expectedProfit;
    return a;
  }, { units: 0, cost: 0, expectedProfit: 0 });
  res.json({
    todaySales: sum(todaySales, 'total'), todayCount: todaySales.length,
    totalSales: sum(sales, 'total'),
    monthlySales: sum(monthSales, 'total'),
    expenses: sum(expenses, 'amount'), monthlyExpenses: sum(monthExp, 'amount'),
    profit: sum(sales, 'profit') - sum(expenses, 'amount'),
    products: products.length,
    stockUnits: stockSummary.units, stockCost: stockSummary.cost, expectedProfit: stockSummary.expectedProfit,
    lowStock: low.map((p) => ({ id: p.id, name: p.name, stock: totalStock(p) })),
    outOfStock: out.map((p) => ({ id: p.id, name: p.name })),
    customers: read('customers').length,
    suppliers: read('suppliers').length,
    pendingLaybys: laybys.filter((l) => l.status === 'Pending').length,
    pendingLaybyValue: laybys.filter((l) => l.status === 'Pending').reduce((a, l) => a + l.balance, 0),
    recent: sales.slice(0, 8).map((s) => ({ receiptNo: s.receiptNo, customerName: s.customerName, total: s.total, date: s.date, staffName: s.staffName })),
  });
});

/* ----------------------------- REPORTS ---------------------------- */
app.get('/api/admin/reports', auth, (req, res) => {
  const from = req.query.from ? new Date(req.query.from).getTime() : 0;
  const to = req.query.to ? new Date(req.query.to).getTime() + 86400000 : Date.now() + 86400000;
  const sales = read('sales').filter((s) => inRange(s.date, from, to));
  const expenses = read('expenses').filter((e) => inRange(e.date, from, to));
  const branches = read('branches');
  const products = read('products');

  const group = (arr, keyFn, valFn) => {
    const m = {};
    arr.forEach((x) => { const k = keyFn(x); m[k] = (m[k] || 0) + valFn(x); });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };
  const items = sales.flatMap((s) => s.items.map((i) => ({ ...i, branchId: s.branchId })));
  const totalSales = sales.reduce((a, s) => a + s.total, 0);
  const totalExpenses = expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
  const grossProfit = sales.reduce((a, s) => a + Number(s.profit || 0), 0);

  res.json({
    daily: group(sales, (s) => new Date(s.date).toISOString().slice(0, 10), (s) => s.total),
    weekly: group(sales, (s) => { const d = new Date(s.date); const on = new Date(d.getFullYear(), 0, 1); return 'Week ' + Math.ceil(((d - on) / 86400000 + on.getDay() + 1) / 7) + ' ' + d.getFullYear(); }, (s) => s.total),
    monthly: group(sales, (s) => new Date(s.date).toISOString().slice(0, 7), (s) => s.total),
    byProduct: group(items, (i) => i.name, (i) => i.total),
    byCategory: group(items, (i) => i.category || 'Uncategorised', (i) => i.total),
    byBranch: group(sales, (s) => (branches.find((b) => b.id === s.branchId) || {}).name || 'Unknown', (s) => s.total),
    byStaff: group(sales, (s) => s.staffName || 'Unknown', (s) => s.total),
    byCustomer: group(sales, (s) => s.customerName || 'Walk-in Customer', (s) => s.total),
    expensesByCategory: group(expenses, (e) => e.category, (e) => Number(e.amount || 0)),
    totals: { totalSales, totalExpenses, grossProfit, netProfit: grossProfit - totalExpenses, transactions: sales.length },
    inventory: products.map((p) => { const summary = productStockSummary(p); return { name: p.name, sku: p.sku, category: p.category, stock: summary.stock, price: p.price, purchasePrice: p.purchasePrice, profit: productProfit(p), value: summary.stockCost, expectedProfit: summary.expectedProfit, status: summary.stock === 0 ? 'Out of stock' : (summary.stock <= Number(p.lowStockLevel || 2) ? 'Low stock' : 'OK') }; }),
    laybys: read('laybys').map(recalcLayby).map((l) => ({ customerName: l.customerName, productName: l.productName, agreedPrice: l.agreedPrice, totalPaid: l.totalPaid, balance: l.balance, status: l.status, dateStarted: l.dateStarted })),
  });
});

/* --------------------------- STATIC UI ---------------------------- */
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.redirect('/login.html'));

app.listen(PORT, () => console.log('Multivision Management System running on port ' + PORT));
