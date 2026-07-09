const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'esoko.db');

if (!fs.existsSync(dbPath)) {
  console.error('Database not found at', dbPath);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

const countMissing = db.prepare("SELECT COUNT(*) AS c FROM users WHERE appNumber IS NULL OR appNumber = ''").get();
console.log('Missing appNumber count:', countMissing.c);

const rows = db.prepare("SELECT id, email, appNumber FROM users ORDER BY updatedAt DESC LIMIT 10").all();
console.log('Recent users:');
for (const r of rows) {
  console.log(r.id, r.email || '-', r.appNumber || '---');
}

db.close();
