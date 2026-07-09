const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'esoko.db');

function gen8() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

if (!fs.existsSync(dbPath)) {
  console.error('Database not found at', dbPath);
  process.exit(1);
}

// Backup DB
try {
  const bakPath = dbPath + '.' + Date.now() + '.bak';
  fs.copyFileSync(dbPath, bakPath);
  console.log('Database backed up to', bakPath);
} catch (err) {
  console.warn('Failed to create DB backup, continuing:', err.message || err);
}

const db = new Database(dbPath);

const selectMissing = db.prepare("SELECT id FROM users WHERE appNumber IS NULL OR appNumber = ''");
const check = db.prepare('SELECT id FROM users WHERE appNumber = ? LIMIT 1');
const update = db.prepare('UPDATE users SET appNumber = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?');

const users = selectMissing.all();
console.log('Users missing appNumber:', users.length);

let assigned = 0;
for (const u of users) {
  let candidate = null;
  for (let i = 0; i < 50; i++) {
    const c = gen8();
    const exists = check.get(c);
    if (!exists) {
      candidate = c;
      break;
    }
  }

  if (!candidate) {
    candidate = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 8);
  }

  try {
    update.run(candidate, u.id);
    console.log('Assigned', candidate, 'to', u.id);
    assigned++;
  } catch (err) {
    console.error('Failed to assign for', u.id, err.message || err);
  }
}

console.log(`Done. Assigned ${assigned} appNumber(s).`);
db.close();
