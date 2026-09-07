/* Multivision Management System - shared frontend logic */
const API = '';
const TOKEN_KEY = 'mv_token';
const USER_KEY = 'mv_user';

function token() { return localStorage.getItem(TOKEN_KEY); }
function currentUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; } }
function logout() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); location.href = 'login.html'; }

async function api(url, options = {}) {
  const opts = { headers: {}, ...options };
  opts.headers['Authorization'] = 'Bearer ' + token();
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(API + url, opts);
  if (res.status === 401) { logout(); throw new Error('unauthorised'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const money = (n) => 'MWK ' + Number(n || 0).toLocaleString('en-US');
const dt = (d) => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const day = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const NAV = [
  ['dashboard.html', 'Dashboard', 'both'],
  ['products.html', 'Products', 'both'],
  ['inventory.html', 'Inventory', 'both'],
  ['sales.html', 'Sales', 'both'],
  ['layby.html', 'Lay-By', 'both'],
  ['customers.html', 'Customers', 'both'],
  ['expenses.html', 'Expenses', 'both'],
  ['suppliers.html', 'Suppliers', 'admin'],
  ['branches.html', 'Branches', 'admin'],
  ['reports.html', 'Reports', 'admin'],
  ['users.html', 'Users', 'admin'],
  ['settings.html', 'Settings', 'admin'],
];

let BRANCHES = [], CATEGORIES = [];

function buildLayout(title) {
  const user = currentUser();
  if (!user || !token()) { location.href = 'login.html'; return; }
  const page = location.pathname.split('/').pop() || 'dashboard.html';
  const links = NAV.filter((n) => n[2] === 'both' || user.role === 'admin')
    .map((n) => `<a href="${n[0]}" class="${n[0] === page ? 'active' : ''}">${n[1]}</a>`).join('');
  document.body.innerHTML = `<div class="layout">
    <aside class="sidebar" id="sidebar">
      <h1>MULTIVISION<br><span>Management System</span></h1>
      <nav>${links}</nav>
    </aside>
    <div class="main">
      <div class="topbar">
        <button class="menu-toggle" onclick="document.getElementById('sidebar').classList.toggle('open')">&#9776;</button>
        <h2>${title}</h2>
        <div class="userbox"><span>${esc(user.name)} (${user.role})</span><button class="btn sm grey" onclick="logout()">Logout</button></div>
      </div>
      <div class="content" id="content"><p class="muted">Loading...</p></div>
    </div></div>`;
}

function el(html) { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
function content(html) { document.getElementById('content').innerHTML = html; }
function modal(html) {
  const m = el(`<div class="modal"><div class="box">${html}</div></div>`);
  m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
  return m;
}
function closeModal(node) { const m = node.closest ? node.closest('.modal') : null; if (m) m.remove(); else document.querySelectorAll('.modal').forEach((x) => x.remove()); }
function branchName(bid) { const b = BRANCHES.find((x) => x.id === bid); return b ? b.name : '-'; }
function stockTotal(p) { return Object.values(p.stock || {}).reduce((a, b) => a + Number(b || 0), 0); }
function stockBadge(p) {
  const t = stockTotal(p);
  if (t === 0) return '<span class="badge out">Out of stock</span>';
  if (t <= Number(p.lowStockLevel || 2)) return '<span class="badge low">Low stock</span>';
  return '<span class="badge ok">In stock</span>';
}

async function boot(title, render) {
  buildLayout(title);
  try {
    [BRANCHES, CATEGORIES] = await Promise.all([api('/api/admin/branches'), api('/api/admin/categories')]);
    await render();
  } catch (e) { content('<div class="panel">' + esc(e.message) + '</div>'); }
}

/* ============================ PAGES ============================ */
const PAGES = {};

PAGES.dashboard = async function () {
  const d = await api('/api/admin/dashboard');
  content(`<div class="cards">
    ${[['Today\'s Sales', money(d.todaySales), 'blue'], ['Total Sales', money(d.totalSales), ''], ['Monthly Sales', money(d.monthlySales), ''],
      ['Expenses', money(d.expenses), 'red'], ['Profit', money(d.profit), 'green'], ['Products', d.products, ''],
      ['Low Stock', d.lowStock.length, 'red'], ['Out of Stock', d.outOfStock.length, 'red'], ['Customers', d.customers, ''],
      ['Suppliers', d.suppliers, ''], ['Pending Lay-Bys', d.pendingLaybys, 'blue'], ['Lay-By Balance', money(d.pendingLaybyValue), '']]
      .map((c) => `<div class="card ${c[2]}"><div class="label">${c[0]}</div><div class="value">${c[1]}</div></div>`).join('')}
  </div>
  <div class="panel"><h3>Recent Transactions</h3><table><thead><tr><th>Receipt</th><th>Customer</th><th>Staff</th><th>Total</th><th>Date</th></tr></thead>
  <tbody>${d.recent.map((s) => `<tr><td>${s.receiptNo}</td><td>${esc(s.customerName)}</td><td>${esc(s.staffName)}</td><td>${money(s.total)}</td><td>${dt(s.date)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No sales recorded yet.</td></tr>'}</tbody></table></div>
  <div class="grid2">
  <div class="panel"><h3>Low Stock Products</h3>${d.lowStock.map((p) => `<div>${esc(p.name)} — <b>${p.stock}</b> left</div>`).join('') || '<span class="muted">None</span>'}</div>
  <div class="panel"><h3>Out of Stock Products</h3>${d.outOfStock.map((p) => `<div>${esc(p.name)}</div>`).join('') || '<span class="muted">None</span>'}</div>
  </div>`);
};

PAGES.products = async function () {
  const products = await api('/api/admin/products');
  window.__products = products;
  content(`<div class="row">
      <input id="search" placeholder="Search products...">
      <select id="fcat"><option value="">All categories</option>${CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select>
      <button class="btn" onclick="productForm()">+ Add Product</button>
    </div><div class="panel" id="list"></div>`);
  const draw = () => {
    const q = document.getElementById('search').value.toLowerCase();
    const cat = document.getElementById('fcat').value;
    const rows = products.filter((p) => (!cat || p.category === cat) && (p.name + p.category).toLowerCase().includes(q));
    document.getElementById('list').innerHTML = `<table><thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Public</th><th></th></tr></thead><tbody>
      ${rows.map((p) => `<tr>
        <td>${p.image ? `<img class="thumb" src="${p.image}">` : '<div class="thumb"></div>'}</td>
        <td>${esc(p.name)}<br><span class="muted">${esc(p.sku)}</span></td>
        <td>${esc(p.category)}</td>
        <td>${money(p.price)}${p.priceMax ? ' - ' + money(p.priceMax) : ''}</td>
        <td>${stockTotal(p)}</td><td>${stockBadge(p)}</td>
        <td>${p.visible ? '<span class="badge ok">Visible</span>' : '<span class="badge out">Hidden</span>'}</td>
        <td style="white-space:nowrap"><button class="btn sm" onclick="productForm('${p.id}')">Edit</button>
        <button class="btn sm grey" onclick="toggleVisible('${p.id}')">${p.visible ? 'Hide' : 'Show'}</button>
        <button class="btn sm red" onclick="deleteProduct('${p.id}')">Delete</button></td></tr>`).join('')}
      </tbody></table>`;
  };
  document.getElementById('search').oninput = draw;
  document.getElementById('fcat').onchange = draw;
  draw();
};

window.productForm = function (pid) {
  const p = (window.__products || []).find((x) => x.id === pid) || { stock: {}, visible: true, available: true };
  const m = modal(`<h3>${pid ? 'Edit' : 'Add'} Product</h3>
    <form id="pform">
      <label>Product Photo</label><input type="file" name="image" accept="image/*">
      ${p.image ? `<p class="muted"><img class="thumb" src="${p.image}"> <button type="button" class="btn sm red" onclick="removeImage('${p.id}')">Delete Photo</button></p>` : ''}
      <div class="grid2">
        <div><label>Name</label><input name="name" required value="${esc(p.name || '')}"></div>
        <div><label>Category</label><select name="category">${CATEGORIES.map((c) => `<option ${c === p.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div><label>Selling Price (MWK)</label><input name="price" type="number" required value="${p.price || ''}"></div>
        <div><label>Max Price (range, optional)</label><input name="priceMax" type="number" value="${p.priceMax || 0}"></div>
        <div><label>Purchase Price</label><input name="purchasePrice" type="number" value="${p.purchasePrice || 0}"></div>
        <div><label>SKU</label><input name="sku" value="${esc(p.sku || '')}"></div>
        <div><label>Low Stock Level</label><input name="lowStockLevel" type="number" value="${p.lowStockLevel || 2}"></div>
        <div><label>Availability</label><select name="available"><option value="true" ${p.available !== false ? 'selected' : ''}>Available</option><option value="false" ${p.available === false ? 'selected' : ''}>Not available</option></select></div>
      </div>
      <label>Specifications</label><textarea name="specifications" rows="2">${esc(p.specifications || '')}</textarea>
      <label>Description</label><textarea name="description" rows="2">${esc(p.description || '')}</textarea>
      <label>Stock per Branch</label><div class="grid3">
        ${BRANCHES.map((b) => `<div><span class="muted">${esc(b.name)}</span><input name="stock_${b.id}" type="number" value="${(p.stock || {})[b.id] || 0}"></div>`).join('')}
      </div>
      <label>Show on public website</label>
      <select name="visible"><option value="true" ${p.visible !== false ? 'selected' : ''}>Visible</option><option value="false" ${p.visible === false ? 'selected' : ''}>Hidden</option></select>
      <p id="err"></p>
      <div class="row" style="margin-top:14px"><button class="btn" type="submit">Save Product</button>
      <button class="btn grey" type="button" onclick="closeModal(this)">Cancel</button></div>
    </form>`);
  m.querySelector('#pform').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api(pid ? '/api/admin/products/' + pid : '/api/admin/products', { method: pid ? 'PUT' : 'POST', body: fd });
      closeModal(e.target); PAGES.products();
    } catch (err) { m.querySelector('#err').innerHTML = '<div class="error">' + esc(err.message) + '</div>'; }
  };
};
window.removeImage = async function (pid) { await api('/api/admin/products/' + pid + '/image', { method: 'DELETE' }); closeModal(document.body); PAGES.products(); };
window.toggleVisible = async function (pid) {
  const p = window.__products.find((x) => x.id === pid);
  const fd = new FormData(); fd.append('visible', p.visible ? 'false' : 'true');
  await api('/api/admin/products/' + pid, { method: 'PUT', body: fd }); PAGES.products();
};
window.deleteProduct = async function (pid) { if (confirm('Delete this product?')) { await api('/api/admin/products/' + pid, { method: 'DELETE' }); PAGES.products(); } };

PAGES.inventory = async function () {
  const [products, moves] = await Promise.all([api('/api/admin/products'), api('/api/admin/stockmoves')]);
  window.__products = products;
  content(`<div class="row"><input id="isearch" placeholder="Search inventory...">
      <button class="btn" onclick="stockForm()">Stock Movement</button></div>
    <div class="panel" id="ilist"></div>
    <div class="panel"><h3>Recent Stock Movements</h3><table><thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Branch</th><th>By</th></tr></thead><tbody>
    ${moves.map((m) => `<tr><td>${dt(m.date)}</td><td>${esc(m.productName)}</td><td>${m.type}${m.toBranchId ? ' → ' + esc(branchName(m.toBranchId)) : ''}</td><td>${m.quantity}</td><td>${esc(branchName(m.branchId))}</td><td>${esc(m.user)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No movements yet.</td></tr>'}
    </tbody></table></div>`);
  const draw = () => {
    const q = document.getElementById('isearch').value.toLowerCase();
    const rows = products.filter((p) => (p.name + p.category + p.sku).toLowerCase().includes(q));
    document.getElementById('ilist').innerHTML = `<table><thead><tr><th>Product</th><th>SKU</th><th>Category</th>${BRANCHES.map((b) => `<th>${esc(b.town)}</th>`).join('')}<th>Total</th><th>Buy</th><th>Sell</th><th>Status</th></tr></thead><tbody>
      ${rows.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.sku)}</td><td>${esc(p.category)}</td>
      ${BRANCHES.map((b) => `<td>${(p.stock || {})[b.id] || 0}</td>`).join('')}
      <td><b>${stockTotal(p)}</b></td><td>${money(p.purchasePrice)}</td><td>${money(p.price)}</td><td>${stockBadge(p)}</td></tr>`).join('')}</tbody></table>`;
  };
  document.getElementById('isearch').oninput = draw; draw();
};

window.stockForm = function () {
  const m = modal(`<h3>Stock Movement</h3><form id="sform">
    <label>Product</label><select name="productId">${window.__products.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
    <div class="grid2">
      <div><label>Type</label><select name="type" id="mtype"><option value="add">Add stock</option><option value="remove">Remove stock</option><option value="adjust">Adjustment (set exact)</option><option value="transfer">Transfer between branches</option></select></div>
      <div><label>Quantity</label><input name="quantity" type="number" value="1"></div>
      <div><label>Branch (from)</label><select name="branchId">${BRANCHES.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
      <div><label>Branch (to, transfers)</label><select name="toBranchId">${BRANCHES.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
    </div>
    <label>Note</label><input name="note">
    <div class="row" style="margin-top:14px"><button class="btn">Save</button><button class="btn grey" type="button" onclick="closeModal(this)">Cancel</button></div></form>`);
  m.querySelector('#sform').onsubmit = async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.target));
    await api('/api/admin/stock', { method: 'POST', body: b });
    closeModal(e.target); PAGES.inventory();
  };
};

PAGES.sales = async function () {
  const [sales, products, customers] = await Promise.all([api('/api/admin/sales'), api('/api/admin/products'), api('/api/admin/customers')]);
  window.__products = products; window.__customers = customers;
  content(`<div class="row"><input id="ssearch" placeholder="Search receipt or customer..."><button class="btn" onclick="saleForm()">+ New Sale</button></div>
  <div class="panel"><table><thead><tr><th>Receipt</th><th>Items</th><th>Customer</th><th>Payment</th><th>Branch</th><th>Staff</th><th>Total</th><th>Date</th></tr></thead>
  <tbody id="srows"></tbody></table></div>`);
  const draw = () => {
    const q = document.getElementById('ssearch').value.toLowerCase();
    document.getElementById('srows').innerHTML = sales.filter((s) => (s.receiptNo + s.customerName).toLowerCase().includes(q))
      .map((s) => `<tr><td>${s.receiptNo}</td><td>${s.items.map((i) => esc(i.name) + ' x' + i.quantity).join('<br>')}</td><td>${esc(s.customerName)}</td><td>${esc(s.paymentMethod)}</td><td>${esc(branchName(s.branchId))}</td><td>${esc(s.staffName)}</td><td>${money(s.total)}</td><td>${dt(s.date)}</td></tr>`).join('')
      || '<tr><td colspan="8" class="muted">No sales yet.</td></tr>';
  };
  document.getElementById('ssearch').oninput = draw; draw();
};

window.saleForm = function () {
  const m = modal(`<h3>New Sale</h3><form id="saleform">
    <label>Product</label><select id="prod">${window.__products.map((p) => `<option value="${p.id}" data-price="${p.price}">${esc(p.name)} — ${money(p.price)}</option>`).join('')}</select>
    <div class="grid3"><div><label>Qty</label><input id="qty" type="number" value="1"></div>
      <div><label>Unit Price</label><input id="uprice" type="number"></div>
      <div style="display:flex;align-items:flex-end"><button type="button" class="btn" onclick="addItem()">Add Item</button></div></div>
    <div class="panel" style="margin-top:10px"><table><tbody id="cart"></tbody></table><p><b id="cartTotal">MWK 0</b></p></div>
    <div class="grid2">
      <div><label>Customer</label><select name="customerId"><option value="">Walk-in Customer</option>${window.__customers.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
      <div><label>Payment Method</label><select name="paymentMethod"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Card</option></select></div>
      <div><label>Branch</label><select name="branchId">${BRANCHES.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
      <div><label>Discount (MWK)</label><input name="discount" type="number" value="0"></div>
    </div>
    <p id="err"></p>
    <div class="row" style="margin-top:12px"><button class="btn green">Complete Sale</button><button type="button" class="btn grey" onclick="closeModal(this)">Cancel</button></div></form>`);
  window.__cart = [];
  const sel = m.querySelector('#prod');
  const setPrice = () => { m.querySelector('#uprice').value = sel.selectedOptions[0].dataset.price; };
  sel.onchange = setPrice; setPrice();
  window.addItem = function () {
    const opt = sel.selectedOptions[0];
    window.__cart.push({ productId: sel.value, name: opt.text.split(' — ')[0], quantity: Number(m.querySelector('#qty').value || 1), price: Number(m.querySelector('#uprice').value || 0) });
    drawCart();
  };
  function drawCart() {
    m.querySelector('#cart').innerHTML = window.__cart.map((i, idx) => `<tr><td>${esc(i.name)}</td><td>x${i.quantity}</td><td>${money(i.price * i.quantity)}</td><td><button type="button" class="btn sm red" onclick="window.__cart.splice(${idx},1);document.getElementById('prod').dispatchEvent(new Event('redraw'))">x</button></td></tr>`).join('');
    m.querySelector('#cartTotal').textContent = money(window.__cart.reduce((a, i) => a + i.price * i.quantity, 0));
  }
  sel.addEventListener('redraw', drawCart);
  m.querySelector('#saleform').onsubmit = async (e) => {
    e.preventDefault();
    if (!window.__cart.length) { m.querySelector('#err').innerHTML = '<div class="error">Add at least one item.</div>'; return; }
    const f = Object.fromEntries(new FormData(e.target));
    const cust = window.__customers.find((c) => c.id === f.customerId);
    try {
      await api('/api/admin/sales', { method: 'POST', body: { items: window.__cart, discount: Number(f.discount || 0), customerId: f.customerId, customerName: cust ? cust.name : 'Walk-in Customer', paymentMethod: f.paymentMethod, branchId: f.branchId } });
      closeModal(e.target); PAGES.sales();
    } catch (err) { m.querySelector('#err').innerHTML = '<div class="error">' + esc(err.message) + '</div>'; }
  };
};

PAGES.expenses = async function () {
  const list = await api('/api/admin/expenses');
  content(`<div class="row"><button class="btn" onclick="expenseForm()">+ Record Expense</button>
    <span class="muted">Total: <b>${money(list.reduce((a, e) => a + Number(e.amount || 0), 0))}</b></span></div>
    <div class="panel"><table><thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Branch</th><th>Description</th><th>Amount</th></tr></thead><tbody>
    ${list.map((e) => `<tr><td>${day(e.date)}</td><td>${esc(e.title)}</td><td>${esc(e.category)}</td><td>${esc(branchName(e.branchId))}</td><td>${esc(e.description)}</td><td>${money(e.amount)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No expenses recorded.</td></tr>'}
    </tbody></table></div>`);
};
window.expenseForm = function () {
  const m = modal(`<h3>Record Expense</h3><form id="ef">
    <label>Expense</label><input name="title" required>
    <div class="grid2">
    <div><label>Category</label><select name="category"><option>Rent</option><option>Transport</option><option>Electricity</option><option>Salaries</option><option>Stock Purchase</option><option>Airtime & Internet</option><option>General</option></select></div>
    <div><label>Amount (MWK)</label><input name="amount" type="number" required></div>
    <div><label>Branch</label><select name="branchId">${BRANCHES.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
    <div><label>Date</label><input name="date" type="date"></div></div>
    <label>Description</label><textarea name="description" rows="2"></textarea>
    <div class="row" style="margin-top:12px"><button class="btn">Save</button><button type="button" class="btn grey" onclick="closeModal(this)">Cancel</button></div></form>`);
  m.querySelector('#ef').onsubmit = async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.target));
    if (b.date) b.date = new Date(b.date).toISOString(); else delete b.date;
    await api('/api/admin/expenses', { method: 'POST', body: b });
    closeModal(e.target); PAGES.expenses();
  };
};

PAGES.customers = async function () {
  const list = await api('/api/admin/customers');
  content(`<div class="row"><input id="csearch" placeholder="Search customers..."><button class="btn" onclick="customerForm()">+ Add Customer</button></div>
  <div class="panel"><table><thead><tr><th>Name</th><th>Phone</th><th>WhatsApp</th><th>Address</th><th>Purchases</th><th>Total Spent</th><th>Outstanding</th><th></th></tr></thead><tbody id="crows"></tbody></table></div>`);
  const draw = () => {
    const q = document.getElementById('csearch').value.toLowerCase();
    document.getElementById('crows').innerHTML = list.filter((c) => (c.name + c.phone).toLowerCase().includes(q))
      .map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.whatsapp)}</td><td>${esc(c.address)}</td><td>${c.purchases}</td><td>${money(c.totalSpent)}</td><td>${money(c.outstanding)}</td>
      <td><button class="btn sm red" onclick="delCustomer('${c.id}')">Delete</button></td></tr>`).join('') || '<tr><td colspan="8" class="muted">No customers yet.</td></tr>';
  };
  document.getElementById('csearch').oninput = draw; draw();
};
window.delCustomer = async function (cid) { if (confirm('Delete customer?')) { await api('/api/admin/customers/' + cid, { method: 'DELETE' }); PAGES.customers(); } };
window.customerForm = function () {
  const m = modal(`<h3>Add Customer</h3><form id="cf">
    <div class="grid2"><div><label>Name</label><input name="name" required></div>
    <div><label>Phone</label><input name="phone"></div>
    <div><label>WhatsApp</label><input name="whatsapp"></div>
    <div><label>Outstanding Balance</label><input name="outstanding" type="number" value="0"></div></div>
    <label>Address</label><input name="address">
    <div class="row" style="margin-top:12px"><button class="btn">Save</button><button type="button" class="btn grey" onclick="closeModal(this)">Cancel</button></div></form>`);
  m.querySelector('#cf').onsubmit = async (e) => { e.preventDefault(); await api('/api/admin/customers', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); closeModal(e.target); PAGES.customers(); };
};

PAGES.suppliers = async function () {
  const list = await api('/api/admin/suppliers');
  content(`<div class="row"><button class="btn" onclick="supplierForm()">+ Add Supplier</button></div>
  <div class="panel"><table><thead><tr><th>Name</th><th>Phone</th><th>Products Supplied</th><th>Purchases</th><th>Amount Owed</th><th></th></tr></thead><tbody>
  ${list.map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.phone)}</td><td>${esc(s.products)}</td><td>${(s.purchases || []).map((p) => esc(p.item) + ' ' + money(p.amount)).join('<br>') || '-'}</td><td>${money(s.amountOwed)}</td>
  <td><button class="btn sm" onclick="purchaseForm('${s.id}')">Add Purchase</button> <button class="btn sm red" onclick="delSupplier('${s.id}')">Delete</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No suppliers yet.</td></tr>'}
  </tbody></table></div>`);
};
window.delSupplier = async function (sid) { if (confirm('Delete supplier?')) { await api('/api/admin/suppliers/' + sid, { method: 'DELETE' }); PAGES.suppliers(); } };
window.supplierForm = function () {
  const m = modal(`<h3>Add Supplier</h3><form id="sf"><label>Name</label><input name="name" required>
    <div class="grid2"><div><label>Phone</label><input name="phone"></div><div><label>Amount Owed</label><input name="amountOwed" type="number" value="0"></div></div>
    <label>Products Supplied</label><input name="products">
    <div class="row" style="margin-top:12px"><button class="btn">Save</button><button type="button" class="btn grey" onclick="closeModal(this)">Cancel</button></div></form>`);
  m.querySelector('#sf').onsubmit = async (e) => { e.preventDefault(); await api('/api/admin/suppliers', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); closeModal(e.target); PAGES.suppliers(); };
};
window.purchaseForm = function (sid) {
  const m = modal(`<h3>Supplier Purchase</h3><form id="pf"><label>Item</label><input name="item" required>
    <div class="grid2"><div><label>Amount</label><input name="amount" type="number" required></div><div><label>Paid</label><input name="paid" type="number" value="0"></div></div>
    <div class="row" style="margin-top:12px"><button class="btn">Save</button><button type="button" class="btn grey" onclick="closeModal(this)">Cancel</button></div></form>`);
  m.querySelector('#pf').onsubmit = async (e) => { e.preventDefault(); await api('/api/admin/suppliers/' + sid + '/purchases', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); closeModal(e.target); PAGES.suppliers(); };
};

PAGES.layby = async function () {
  const [list, products] = await Promise.all([api('/api/admin/laybys'), api('/api/admin/products')]);
  window.__products = products;
  content(`<div class="row"><button class="btn" onclick="laybyForm()">+ New Lay-By</button>
    <span class="muted">Pending balance: <b>${money(list.filter((l) => l.status === 'Pending').reduce((a, l) => a + l.balance, 0))}</b></span></div>
  <div class="panel"><table><thead><tr><th>Receipt</th><th>Customer</th><th>Product</th><th>Agreed Price</th><th>Paid</th><th>Balance</th><th>Status</th><th>Branch</th><th>Started</th><th></th></tr></thead><tbody>
  ${list.map((l) => `<tr><td>${l.receiptNo}</td><td>${esc(l.customerName)}<br><span class="muted">${esc(l.phone)}</span></td><td>${esc(l.productName)}</td><td>${money(l.agreedPrice)}</td><td>${money(l.totalPaid)}</td><td><b>${money(l.balance)}</b></td>
  <td><span class="badge ${l.status === 'Completed' ? 'ok' : 'low'}">${l.status}</span></td><td>${esc(branchName(l.branchId))}</td><td>${day(l.dateStarted)}</td>
  <td style="white-space:nowrap"><button class="btn sm green" onclick="payLayby('${l.id}')">Payment</button> <button class="btn sm grey" onclick="viewLayby('${l.id}')">History</button></td></tr>`).join('') || '<tr><td colspan="10" class="muted">No lay-bys yet.</td></tr>'}
  </tbody></table></div>`);
  window.__laybys = list;
};
window.laybyForm = function () {
  const m = modal(`<h3>New Lay-By</h3><form id="lf">
    <div class="grid2"><div><label>Customer Name</label><input name="customerName" required></div><div><label>Phone</label><input name="phone"></div></div>
    <label>Product</label><select name="productId" id="lp">${window.__products.map((p) => `<option value="${p.id}" data-name="${esc(p.name)}" data-price="${p.price}">${esc(p.name)} — ${money(p.price)}</option>`).join('')}</select>
    <div class="grid2"><div><label>Agreed Price (fixed)</label><input name="agreedPrice" id="lprice" type="number" required></div>
    <div><label>Initial Payment</label><input name="initialPayment" type="number" value="0"></div>
    <div><label>Branch</label><select name="branchId">${BRANCHES.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
    <div><label>Payment Method</label><select name="paymentMethod"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option></select></div></div>
    <label>Notes</label><textarea name="notes" rows="2"></textarea>
    <div class="row" style="margin-top:12px"><button class="btn">Save</button><button type="button" class="btn grey" onclick="closeModal(this)">Cancel</button></div></form>`);
  const sel = m.querySelector('#lp');
  const sync = () => { m.querySelector('#lprice').value = sel.selectedOptions[0].dataset.price; };
  sel.onchange = sync; sync();
  m.querySelector('#lf').onsubmit = async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.target));
    b.productName = sel.selectedOptions[0].dataset.name;
    await api('/api/admin/laybys', { method: 'POST', body: b });
    closeModal(e.target); PAGES.layby();
  };
};
window.payLayby = function (lid) {
  const m = modal(`<h3>Record Lay-By Payment</h3><form id="pl">
    <div class="grid2"><div><label>Amount</label><input name="amount" type="number" required></div>
    <div><label>Method</label><select name="method"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option></select></div></div>
    <div class="row" style="margin-top:12px"><button class="btn">Save Payment</button><button type="button" class="btn grey" onclick="closeModal(this)">Cancel</button></div></form>`);
  m.querySelector('#pl').onsubmit = async (e) => {
    e.preventDefault();
    const r = await api('/api/admin/laybys/' + lid + '/payments', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
    closeModal(e.target);
    modal(`<h3>Payment Receipt</h3><p>Receipt No: <b>${r.payment.receiptNo}</b><br>Customer: ${esc(r.layby.customerName)}<br>Product: ${esc(r.layby.productName)}<br>
      Amount Paid: <b>${money(r.payment.amount)}</b><br>Total Paid: ${money(r.layby.totalPaid)}<br>Agreed Price: ${money(r.layby.agreedPrice)}<br>Balance: <b>${money(r.layby.balance)}</b><br>Date: ${dt(r.payment.date)}</p>
      <div class="row"><button class="btn" onclick="window.print()">Print</button><button class="btn grey" onclick="closeModal(this);PAGES.layby()">Close</button></div>`);
  };
};
window.viewLayby = function (lid) {
  const l = window.__laybys.find((x) => x.id === lid);
  modal(`<h3>Lay-By ${l.receiptNo}</h3><p>${esc(l.customerName)} — ${esc(l.productName)}<br>Agreed: <b>${money(l.agreedPrice)}</b> · Paid: ${money(l.totalPaid)} · Balance: <b>${money(l.balance)}</b></p>
    <table><thead><tr><th>Receipt</th><th>Amount</th><th>Method</th><th>Date</th><th>Staff</th></tr></thead><tbody>
    ${(l.payments || []).map((p) => `<tr><td>${p.receiptNo}</td><td>${money(p.amount)}</td><td>${esc(p.method)}</td><td>${dt(p.date)}</td><td>${esc(p.staffName)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No payments yet.</td></tr>'}</tbody></table>
    <p class="muted">${esc(l.notes || '')}</p><div class="row"><button class="btn grey" onclick="closeModal(this)">Close</button></div>`);
};

PAGES.branches = async function () {
  const [branches, products] = await Promise.all([api('/api/admin/branches'), api('/api/admin/products')]);
  content(branches.map((b) => `<div class="panel"><h3>${esc(b.name)}</h3><p class="muted">${esc(b.address)}<br>Phone: ${esc(b.phone)}</p>
    <p>Products in stock: <b>${products.filter((p) => Number((p.stock || {})[b.id] || 0) > 0).length}</b> ·
    Stock units: <b>${products.reduce((a, p) => a + Number((p.stock || {})[b.id] || 0), 0)}</b> ·
    Stock value: <b>${money(products.reduce((a, p) => a + Number((p.stock || {})[b.id] || 0) * Number(p.purchasePrice || 0), 0))}</b></p></div>`).join(''));
};

PAGES.users = async function () {
  const users = await api('/api/admin/users');
  content(`<div class="row"><button class="btn" onclick="userForm()">+ Add User</button></div>
  <div class="panel"><table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Branch</th><th>Status</th><th></th></tr></thead><tbody>
  ${users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${u.role}</td><td>${esc(branchName(u.branchId))}</td><td>${u.active === false ? 'Disabled' : 'Active'}</td>
  <td><button class="btn sm" onclick="resetPw('${u.id}')">Reset Password</button> <button class="btn sm red" onclick="delUser('${u.id}')">Delete</button></td></tr>`).join('')}
  </tbody></table></div>`);
};
window.delUser = async function (uid) { if (confirm('Delete user?')) { await api('/api/admin/users/' + uid, { method: 'DELETE' }); PAGES.users(); } };
window.resetPw = async function (uid) { const p = prompt('New password:'); if (p) { await api('/api/admin/users/' + uid, { method: 'PUT', body: { password: p } }); alert('Password updated'); } };
window.userForm = function () {
  const m = modal(`<h3>Add User</h3><form id="uf"><div class="grid2">
    <div><label>Full Name</label><input name="name" required></div><div><label>Username</label><input name="username" required></div>
    <div><label>Password</label><input name="password" type="password" required></div>
    <div><label>Role</label><select name="role"><option value="staff">Staff / Cashier</option><option value="admin">Admin</option></select></div>
    <div><label>Branch</label><select name="branchId">${BRANCHES.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div></div>
    <div class="row" style="margin-top:12px"><button class="btn">Save</button><button type="button" class="btn grey" onclick="closeModal(this)">Cancel</button></div></form>`);
  m.querySelector('#uf').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/api/admin/users', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); closeModal(e.target); PAGES.users(); }
    catch (err) { alert(err.message); }
  };
};

PAGES.settings = async function () {
  const s = await api('/api/admin/settings');
  content(`<div class="panel" style="max-width:520px"><h3>Business Settings</h3><form id="setf">
    <label>Business Name</label><input name="businessName" value="${esc(s.businessName || '')}">
    <label>Phone</label><input name="phone" value="${esc(s.phone || '')}">
    <label>WhatsApp (international format)</label><input name="whatsapp" value="${esc(s.whatsapp || '')}">
    <label>Currency</label><input name="currency" value="${esc(s.currency || 'MWK')}">
    <label>Add Category</label><input name="newCategory" placeholder="e.g. Printers">
    <div class="row" style="margin-top:12px"><button class="btn">Save</button></div></form>
    <p class="muted">Categories: ${CATEGORIES.join(', ')}</p></div>`);
  document.getElementById('setf').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (f.newCategory) await api('/api/admin/categories', { method: 'POST', body: { name: f.newCategory } });
    delete f.newCategory;
    await api('/api/admin/settings', { method: 'PUT', body: f });
    alert('Settings saved'); PAGES.settings();
  };
};

PAGES.reports = async function () {
  content(`<div class="row"><input type="date" id="from"><input type="date" id="to"><button class="btn" onclick="loadReports()">Apply</button></div><div id="rep"></div>`);
  window.loadReports = async function () {
    const from = document.getElementById('from').value, to = document.getElementById('to').value;
    const r = await api('/api/admin/reports?from=' + from + '&to=' + to);
    const tbl = (title, rows, fmt = money) => `<div class="panel"><h3>${title}</h3><table><tbody>${rows.map((x) => `<tr><td>${esc(x.name)}</td><td style="text-align:right">${fmt(x.value)}</td></tr>`).join('') || '<tr><td class="muted">No data</td></tr>'}</tbody></table></div>`;
    document.getElementById('rep').innerHTML = `<div class="cards">
      <div class="card blue"><div class="label">Total Sales</div><div class="value">${money(r.totals.totalSales)}</div></div>
      <div class="card red"><div class="label">Total Expenses</div><div class="value">${money(r.totals.totalExpenses)}</div></div>
      <div class="card"><div class="label">Gross Profit</div><div class="value">${money(r.totals.grossProfit)}</div></div>
      <div class="card green"><div class="label">Net Profit / Loss</div><div class="value">${money(r.totals.netProfit)}</div></div>
      <div class="card"><div class="label">Transactions</div><div class="value">${r.totals.transactions}</div></div></div>
      <div class="grid2">${tbl('Daily Sales', r.daily)}${tbl('Weekly Sales', r.weekly)}${tbl('Monthly Sales', r.monthly)}${tbl('Product Sales', r.byProduct)}
      ${tbl('Category Sales', r.byCategory)}${tbl('Branch Sales', r.byBranch)}${tbl('Staff Sales', r.byStaff)}${tbl('Customer Purchases', r.byCustomer)}
      ${tbl('Expenses by Category', r.expensesByCategory)}</div>
      <div class="panel"><h3>Inventory Report</h3><table><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Stock</th><th>Value</th><th>Status</th></tr></thead><tbody>
      ${r.inventory.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.sku)}</td><td>${esc(i.category)}</td><td>${i.stock}</td><td>${money(i.value)}</td><td>${i.status}</td></tr>`).join('')}</tbody></table></div>
      <div class="panel"><h3>Low Stock Report</h3><table><tbody>${r.inventory.filter((i) => i.status !== 'OK').map((i) => `<tr><td>${esc(i.name)}</td><td>${i.stock}</td><td>${i.status}</td></tr>`).join('') || '<tr><td class="muted">All good</td></tr>'}</tbody></table></div>
      <div class="panel"><h3>Lay-By Report</h3><table><thead><tr><th>Customer</th><th>Product</th><th>Agreed</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>
      ${r.laybys.map((l) => `<tr><td>${esc(l.customerName)}</td><td>${esc(l.productName)}</td><td>${money(l.agreedPrice)}</td><td>${money(l.totalPaid)}</td><td>${money(l.balance)}</td><td>${l.status}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No lay-bys</td></tr>'}</tbody></table></div>`;
  };
  window.loadReports();
};

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (!page || page === 'login') return;
  const titles = { dashboard: 'Admin Dashboard', products: 'Product Management', inventory: 'Inventory', sales: 'Sales', expenses: 'Expenses', customers: 'Customers', suppliers: 'Suppliers', layby: 'Lay-By Management', reports: 'Reports', branches: 'Branches', users: 'Users & Roles', settings: 'Settings' };
  boot(titles[page] || page, PAGES[page]);
});
