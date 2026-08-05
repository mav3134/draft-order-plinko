/*
 * Draft Order Plinko
 * ==================
 * Node/Express server for a Price is Right style Plinko game that decides a
 * draft order. The frontend lives in public/ and is served statically; the
 * three /api/plinko endpoints below hold the one shared source of truth for
 * the game, so every player sees the same board no matter what machine they
 * open it on.
 *
 * Persistence (pick one, automatically):
 *   - If AZURE_STORAGE_CONNECTION_STRING is set, state is stored as
 *     plinko.json in the "plinko" blob container (survives redeploys and
 *     app restarts on Azure App Service).
 *   - Otherwise state is stored in data/plinko.json on local disk (fine for
 *     running on any plain server / your own machine).
 *
 * Env: PORT (default 3000), AZURE_STORAGE_CONNECTION_STRING (optional)
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const NAMES = ['Andrew', 'Balmer', 'Brent', 'Evan', 'Greg', 'Jay', 'Mikaela', 'Sam', 'Steph', 'Steve'];
// Bottom slot draft positions left→right: 1st in the middle, evens fan left,
// odds fan right, so 9th and 10th end up on the outside edges.
const LABELS = [10, 8, 6, 4, 2, 1, 3, 5, 7, 9];
const RESET_PASSWORD = 'draft31';
// On Azure App Service, /home is persistent shared storage that survives both
// restarts and redeploys (the deploy only replaces /home/site/wwwroot), so the
// game state lives there with zero extra configuration. Anywhere else, it
// lives next to the code in data/plinko.json.
const LOCAL_STATE_FILE = process.env.WEBSITE_SITE_NAME
  ? '/home/data/plinko.json'
  : path.join(__dirname, 'data', 'plinko.json');

let db = null;          // {mapping, filled, createdAt}
let blobClient = null;  // BlockBlobClient for plinko.json when Azure is configured

function freshDB() {
  // Random permutation: chips dropped in top slot i always land in bottom
  // slot mapping[i]. The mapping is never sent to clients — the landing slot
  // only comes back from /api/plinko/drop, so it can't be sniffed in advance.
  const mapping = [...Array(10).keys()];
  for (let i = mapping.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [mapping[i], mapping[j]] = [mapping[j], mapping[i]];
  }
  return { mapping, filled: Array(10).fill(null), createdAt: new Date().toISOString() };
}

async function initStorage() {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connStr) {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const container = BlobServiceClient.fromConnectionString(connStr).getContainerClient('plinko');
    await container.createIfNotExists();
    blobClient = container.getBlockBlobClient('plinko.json');
    if (await blobClient.exists()) {
      try { db = JSON.parse((await blobClient.downloadToBuffer()).toString('utf8')); }
      catch (e) { console.warn('Could not parse plinko.json from blob:', e.message); }
    }
    console.log('Storage: Azure Blob');
  } else {
    try { db = JSON.parse(fs.readFileSync(LOCAL_STATE_FILE, 'utf8')); }
    catch (e) { /* first run — no state yet */ }
    console.log('Storage: local file ' + LOCAL_STATE_FILE);
  }
  if (!db || !Array.isArray(db.mapping) || !Array.isArray(db.filled)) {
    db = freshDB();
    await saveDB();
  }
}

async function saveDB() {
  const json = JSON.stringify(db, null, 2);
  if (blobClient) {
    const buf = Buffer.from(json);
    await blobClient.uploadData(buf, { blobHTTPHeaders: { blobContentType: 'application/json' } });
  } else {
    fs.mkdirSync(path.dirname(LOCAL_STATE_FILE), { recursive: true });
    fs.writeFileSync(LOCAL_STATE_FILE, json);
  }
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function statePayload() {
  const order = [];
  db.filled.forEach((name, i) => {
    if (name) order.push({ name, position: LABELS[i], bottomIndex: i });
  });
  order.sort((a, b) => a.position - b.position);
  return {
    names: NAMES,
    labels: LABELS,
    filled: db.filled.slice(),   // bottom slots left→right: player name or null
    played: db.filled.filter(Boolean),
    order,
  };
}

app.get('/api/plinko/state', (req, res) => {
  if (!db) return res.status(503).json({ error: 'Storage not ready' });
  res.json(statePayload());
});

// One authoritative drop: validates the player, resolves the secret top→bottom
// mapping, and records the result before the client even starts animating.
app.post('/api/plinko/drop', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Storage not ready' });
  const name = req.body && req.body.name;
  const slot = Number(req.body && req.body.topSlot);
  if (!NAMES.includes(name)) return res.status(400).json({ error: 'Unknown name' });
  if (!Number.isInteger(slot) || slot < 0 || slot > 9) return res.status(400).json({ error: 'Bad slot' });
  if (db.filled.includes(name)) {
    return res.status(409).json({ error: 'already_played', state: statePayload() });
  }
  const bottomIndex = db.mapping[slot];
  if (db.filled[bottomIndex]) {
    // Capped slot — the chip clanks off and falls away; nothing is recorded,
    // so the player keeps their turn and can pick a different top slot.
    return res.json({ result: 'blocked', bottomIndex, state: statePayload() });
  }
  db.filled[bottomIndex] = name;
  try { await saveDB(); } catch (e) {
    db.filled[bottomIndex] = null;
    return res.status(500).json({ error: e.message });
  }
  res.json({ result: 'landed', bottomIndex, position: LABELS[bottomIndex], state: statePayload() });
});

app.post('/api/plinko/reset', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Storage not ready' });
  if (((req.body && req.body.password) || '') !== RESET_PASSWORD) {
    return res.status(403).json({ error: 'Wrong password' });
  }
  const fresh = freshDB();
  const old = db;
  db = fresh;
  try { await saveDB(); } catch (e) { db = old; return res.status(500).json({ error: e.message }); }
  res.json({ ok: true, state: statePayload() });
});

initStorage()
  .catch(e => { console.error('Storage init failed:', e.message); })
  .finally(() => {
    app.listen(PORT, () => console.log(`Draft Order Plinko running on port ${PORT}`));
  });
