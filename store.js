const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, 'data');

function file(name) { return path.join(DATA, name + '.json'); }

function read(name, fallback) {
  try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); }
  catch (e) { return fallback === undefined ? [] : fallback; }
}

function write(name, value) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(file(name), JSON.stringify(value, null, 2));
  return value;
}

function id(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

module.exports = { read, write, id, DATA };
