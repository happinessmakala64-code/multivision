/* Generates system/data/*.json with the real Multivision product catalogue. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA, { recursive: true });

const BRANCHES = [
  { id: 'br1', name: 'Mzuzu — St Augustine Market', town: 'Mzuzu', address: 'Opposite Mzuni in St Augustine Market.', phone: '0992282807' },
  { id: 'br2', name: 'Mzuzu — Near Mzuzu University', town: 'Mzuzu', address: 'Just after Mzuzu University Main Gate, 30 metres ahead towards Kaka Motel, on the right-hand side after Cape Restaurant. Look for the MULTIVISION ELECTRONICS & INVESTMENTS sign post.', phone: '0992282807' },
  { id: 'br3', name: 'Zomba — An Juman Shopping Mall', town: 'Zomba', address: 'At An Juman Shopping Mall.', phone: '0992282807' },
];

const CATEGORIES = ['Laptops','Smartphones','Keypad Phones','Laptop Chargers','Phone Chargers','Power Banks','Headsets & Earphones','Hard Drives','RAM','Flash Drives','Memory Cards','Hot Plates','Water Heaters','AirPods','USB Cables','HDMI Cables','VGA Cables','LED Bulbs','Extensions','Sockets & Adapters','TV/DVD Remotes','OTG Adapters','Screen Protectors','Batteries','Solar Lanterns','Other Electronics'];

// [name, category, price, priceMax(0=none), specs]
const P = [
  ['Lenovo IdeaPad Core i5','Laptops',645000,0,'RAM 4GB DDR4, 500GB HDD, battery 9 hours'],
  ['Lenovo IdeaPad','Laptops',495000,0,'RAM 4GB DDR4, 320GB HDD, battery 7 hours'],
  ['Acer Aspire Core i5','Laptops',385000,0,'RAM 4GB, 500GB HDD, processor 2.40GHz, battery 3 hours'],
  ['Dell Inspiron Notebook PC','Laptops',295000,0,'RAM 4GB, 500GB HDD, battery some minutes'],
  ['HP ProBook Core i5','Laptops',295000,0,'RAM 4GB, 320GB HDD, metallic casing, fingerprint scanner, battery zero'],
  ['Dell Inspiron Notebook Core i5','Laptops',875000,0,'RAM 4GB DDR4, 500GB HDD, battery 9 hours'],
  ['HP 250 Notebook','Laptops',620000,0,'RAM 4GB, 500GB HDD, battery 8 hours'],
  ['HP 250 AMD A6','Laptops',745000,0,'RAM 4GB DDR4, 500GB HDD, battery 9 hours'],
  ['Dell Inspiron Notebook','Laptops',295000,0,'RAM 4GB, 500GB HDD'],
  ['Lenovo IdeaPad Notebook Core i3','Laptops',875000,0,'RAM 4GB DDR4, 500GB HDD, battery 8 hours'],
  ['HP 250','Laptops',645000,0,'RAM 4GB, 500GB HDD, battery 8 hours'],
  ['HP 620','Laptops',365000,0,'RAM 4GB, 500GB HDD, battery 3 hours, metallic casing'],
  ['Dell Inspiron Notebook AMD','Laptops',650000,0,'RAM 4GB, 500GB HDD, battery 8 hours'],
  ['Dell Inspiron Notebook Core i5 (320GB)','Laptops',500000,0,'RAM 4GB DDR4, 320GB HDD, battery 3 hours'],
  ['Dell Mini Laptop','Laptops',125000,0,'RAM 4GB, no hard drive, battery zero'],
  ['HP Notebook','Laptops',645000,0,'RAM 4GB, 500GB HDD, battery 9 hours'],

  ['Huawei Nova 4','Smartphones',285000,0,'RAM 8GB, storage 128GB'],
  ['Redmi 6A','Smartphones',125000,0,'RAM 3GB, storage 32GB'],
  ['Huawei Mate 10','Smartphones',240000,0,'RAM 6GB, storage 128GB'],
  ['Honor 8 Lite','Smartphones',160000,0,'RAM 4GB, storage 32GB'],
  ['Honor 9 Lite','Smartphones',170000,0,'RAM 4GB, storage 64GB'],
  ['Honor 7X 32GB','Smartphones',172000,0,'RAM 4GB, storage 32GB'],
  ['Mi Play','Smartphones',185000,0,'RAM 6GB, storage 64GB'],
  ['Honor 7X 128GB','Smartphones',205000,0,'RAM 4GB, storage 128GB'],
  ['Huawei P20','Smartphones',235000,0,'RAM 4GB, storage 128GB'],
  ['Huawei Y9 2019','Smartphones',240000,0,'RAM 4GB, storage 128GB'],

  ['Triple SIM Keypad Phone','Keypad Phones',30000,0,'Triple SIM, torch, FM radio'],
  ['KGTEL Keypad Phone','Keypad Phones',32000,0,'Dual SIM, torch, FM radio'],
  ['Itel 2163','Keypad Phones',35000,0,'Small battery'],
  ['Itel 5606','Keypad Phones',45000,0,'Big battery'],
  ['Itel 2160','Keypad Phones',43000,0,'Small battery'],

  ['Diamond Double Hotplates','Hot Plates',90000,0,'Diamond brand, double burner'],
  ['Double Hotplate','Hot Plates',55000,0,'Double burner hot plate'],
  ['Single Hotplate','Hot Plates',35000,0,'Single burner hot plate'],
  ['500GB Laptop Hard Drive','Hard Drives',40000,0,'2.5" SATA laptop hard drive, 500GB'],
  ['320GB Laptop Hard Drive','Hard Drives',30000,0,'2.5" SATA laptop hard drive, 320GB'],
  ['1TB Laptop Hard Drive','Hard Drives',70000,0,'2.5" SATA laptop hard drive, 1TB'],
  ['250GB Laptop Hard Drive','Hard Drives',25000,0,'2.5" SATA laptop hard drive, 250GB'],
  ['4GB DDR3 RAM','RAM',14000,0,'Laptop memory module, 4GB DDR3'],
  ['Oraimo Power Bank','Power Banks',45000,0,'Oraimo branded power bank'],
  ['Power Bank','Power Banks',20000,0,'Portable power bank'],
  ['Brand New Laptop Charger','Laptop Chargers',33000,0,'Brand new universal/original laptop charger'],
  ['Type-C Laptop Charger','Laptop Chargers',55000,65000,'Type-C laptop charger, price depends on wattage'],
  ['Water Heater','Water Heaters',7000,30000,'Immersion water heaters, various sizes'],
  ['AirPods','AirPods',15000,45000,'Wireless earbuds, various models'],
  ['Type-C Phone Charger','Phone Chargers',8000,20000,'Type-C phone charger, various capacities'],
  ['Type-B Phone Charger','Phone Chargers',3500,17000,'Type-B (micro USB) phone charger'],
  ['Type-C USB Cable','USB Cables',4000,8500,'Type-C data & charging cable'],
  ['USB Cable','USB Cables',3000,8000,'Standard USB data & charging cable'],
  ['Earphones','Headsets & Earphones',5000,8500,'Wired earphones with mic'],
  ['Type-C Headsets','Headsets & Earphones',10000,0,'Type-C wired headsets'],
  ['Wireless Headphones','Headsets & Earphones',25000,0,'Bluetooth wireless headphones'],
  ['Universal LED TV Remote','TV/DVD Remotes',10000,0,'Universal remote for LED TVs'],
  ['Universal DVD Remote','TV/DVD Remotes',8000,0,'Universal remote for DVD players'],
  ['LED Bulb 7W','LED Bulbs',1800,0,'7 watt LED bulb'],
  ['LED Bulb 9W','LED Bulbs',2300,0,'9 watt LED bulb'],
  ['Rechargeable Bulb','LED Bulbs',25000,0,'Rechargeable LED bulb with backup battery'],
  ['Bulb Holder','Sockets & Adapters',2500,0,'Standard bulb holder'],
  ['Single Socket','Sockets & Adapters',6500,0,'Single wall socket'],
  ['Double Socket','Sockets & Adapters',14000,0,'Double wall socket'],
  ['Socket Adapter','Sockets & Adapters',8000,8500,'Multi-plug socket adapter'],
  ['TV & Fridge Guard','Other Electronics',28000,0,'Voltage guard for TV and fridge'],
  ['VGA Cable 5M','VGA Cables',10000,0,'5 metre VGA cable'],
  ['VGA Cable 3M','VGA Cables',8000,0,'3 metre VGA cable'],
  ['VGA Cable 1.5M','VGA Cables',4000,0,'1.5 metre VGA cable'],
  ['HDMI Cable 3M','HDMI Cables',8000,0,'3 metre HDMI cable'],
  ['HDMI Cable 5M','HDMI Cables',15000,0,'5 metre HDMI cable'],
  ['D-Light Solar Lantern','Solar Lanterns',12000,0,'D-Light rechargeable solar lantern'],
  ['AV Cable','Other Electronics',2500,0,'Audio/Video RCA cable'],
  ['Wall Wrapper 10M','Other Electronics',35000,0,'Decorative wall wrapper, 10 metres'],
  ['Scientific Calculator','Other Electronics',6000,0,'Scientific calculator for school and college'],
  ['Laptop Charger Power Cable','Laptop Chargers',5000,0,'Power cable for laptop charger'],
  ['Desktop Power Cable','Other Electronics',5000,0,'Desktop computer power cable'],
  ['OTG Type-B','OTG Adapters',5000,0,'OTG adapter, micro USB (Type-B)'],
  ['OTG Type-C','OTG Adapters',6000,0,'OTG adapter, Type-C'],
  ['OTG iPhone','OTG Adapters',7000,0,'OTG adapter accessory for iPhone lightning port'],
  ['Phone Screen Protector','Screen Protectors',4500,0,'Tempered glass screen protector'],
  ['Extension 6 Holes','Extensions',25000,0,'Extension cable with 6 sockets'],
  ['Extension 5 Holes','Extensions',20000,0,'Extension cable with 5 sockets'],
  ['Extension 4 Holes','Extensions',18000,0,'Extension cable with 4 sockets'],
  ['Extension 3 Holes with USB','Extensions',18000,0,'Extension cable with 3 sockets and USB ports'],
  ['Flash Drive 2GB - 64GB','Flash Drives',12000,40000,'USB flash drives from 2GB up to 64GB'],
  ['Memory Card 2GB - 64GB','Memory Cards',8500,30000,'Micro SD memory cards from 2GB up to 64GB'],
  ['Itel Small Battery','Batteries',7500,0,'Replacement small battery for Itel phones'],
  ['Itel Big Battery','Batteries',14000,0,'Replacement big battery for Itel phones'],
  ['Tecno Small Battery','Batteries',8000,0,'Replacement small battery for Tecno phones'],
  ['Tecno Big Battery','Batteries',15000,0,'Replacement big battery for Tecno phones'],
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const now = new Date().toISOString();

const products = P.map((p, i) => {
  const [name, category, price, priceMax, specs] = p;
  const stock = { br1: 3 + (i % 5), br2: 2 + (i % 4), br3: 1 + (i % 3) };
  return {
    id: 'p' + String(i + 1).padStart(3, '0'),
    sku: (category.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')) + '-' + String(i + 1).padStart(3, '0'),
    name, category,
    slug: slug(name),
    description: name + ' available at Multivision Electronics & Investments.',
    specifications: specs,
    price, priceMax,
    purchasePrice: Math.round(price * 0.75),
    stock,
    lowStockLevel: 2,
    supplierId: '',
    image: '',
    available: true,
    visible: true,
    createdAt: now,
    updatedAt: now,
  };
});

function hash(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}

const users = [
  { id: 'u1', username: 'admin', name: 'Administrator', role: 'admin', branchId: 'br1', passwordHash: hash(process.env.SEED_ADMIN_PASSWORD || 'admin123'), active: true },
  { id: 'u2', username: 'cashier', name: 'Shop Cashier', role: 'staff', branchId: 'br1', passwordHash: hash(process.env.SEED_STAFF_PASSWORD || 'cashier123'), active: true },
];

const files = {
  'branches.json': BRANCHES,
  'categories.json': CATEGORIES,
  'products.json': products,
  'users.json': users,
  'sales.json': [],
  'expenses.json': [],
  'customers.json': [],
  'suppliers.json': [],
  'laybys.json': [],
  'stockmoves.json': [],
  'settings.json': { businessName: 'MULTIVISION ELECTRONICS & INVESTMENTS', phone: '0992282807', whatsapp: '265992282807', currency: 'MWK' },
};

for (const [f, v] of Object.entries(files)) {
  const target = path.join(DATA, f);
  if (process.argv.includes('--force') || !fs.existsSync(target)) {
    fs.writeFileSync(target, JSON.stringify(v, null, 2));
    console.log('wrote', f);
  }
}
