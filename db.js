const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const cache = new Map();
const timers = new Map();

function getJson(filename, fallback = {}) {
  const name = path.basename(filename);
  if (!cache.has(name)) {
    const filePath = path.join(__dirname, name);
    if (!fs.existsSync(filePath)) {
      cache.set(name, structuredClone(fallback));
    } else {
      try {
        cache.set(name, JSON.parse(fs.readFileSync(filePath, 'utf8')));
      } catch {
        cache.set(name, structuredClone(fallback));
      }
    }
  }
  return cache.get(name);
}

function saveJson(filename, data) {
  const name = path.basename(filename);
  cache.set(name, data);

  if (timers.has(name)) clearTimeout(timers.get(name));
  timers.set(
    name,
    setTimeout(async () => {
      timers.delete(name);
      const filePath = path.join(__dirname, name);
      await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8').catch(console.error);
    }, 1000)
  );
}

async function flushAll() {
  for (const [name, timer] of timers.entries()) {
    clearTimeout(timer);
    timers.delete(name);
    const filePath = path.join(__dirname, name);
    await fsp.writeFile(filePath, JSON.stringify(cache.get(name), null, 2), 'utf8').catch(() => {});
  }
}

process.on('SIGINT', async () => { await flushAll(); process.exit(0); });
process.on('SIGTERM', async () => { await flushAll(); process.exit(0); });

module.exports = { getJson, saveJson, flushAll };
