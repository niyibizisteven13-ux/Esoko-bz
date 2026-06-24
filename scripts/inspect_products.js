const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'data', 'esoko.db');
const db = new Database(dbPath, { readonly: true });

const rows = db.prepare(`SELECT id, traderId, name, code, status, image, images, metadata, createdAt FROM products ORDER BY datetime(createdAt) DESC LIMIT 30`).all();

console.log('Recent products:');
rows.forEach((r, i) => {
  console.log(`\n#${i + 1}`);
  console.log(`id: ${r.id}`);
  console.log(`traderId: ${r.traderId}`);
  console.log(`name: ${r.name}`);
  console.log(`code: ${r.code}`);
  console.log(`status: ${r.status}`);
  console.log(`image: ${r.image}`);
  console.log(`images: ${r.images}`);
  console.log(`metadata: ${r.metadata}`);
  console.log(`createdAt: ${r.createdAt}`);
});

db.close();
