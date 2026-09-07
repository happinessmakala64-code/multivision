const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, 'data');
const cache = new Map();

function file(name) { return path.join(DATA, name + '.json'); }

function read(name, fallback) {
  if (cache.has(name)) return cache.get(name);
  try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); }
  catch (e) {
    const value = fallback === undefined ? [] : fallback;
    cache.set(name, value);
    return value;
  }
}

function write(name, value) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(file(name), JSON.stringify(value));
  cache.set(name, value);
  return value;
}

function id(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

module.exports = { read, write, id, DATA };
