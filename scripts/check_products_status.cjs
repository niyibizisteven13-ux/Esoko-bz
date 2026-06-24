const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'data', 'esoko.db');
const db = new Database(dbPath, { readonly: true });

const rows = db.prepare(`SELECT p.id, p.traderId, p.name, p.status, p.image, p.images, p.metadata, p.createdAt, u.verificationStatus FROM products p LEFT JOIN users u ON u.id = p.traderId WHERE p.status != 'available' ORDER BY datetime(p.createdAt) DESC LIMIT 30`).all();

console.log('Non-available recent products:');
rows.forEach((r, i) => {
  console.log(`\n#${i + 1}`);
  console.log(`product id: ${r.id}`);
  console.log(`traderId: ${r.traderId}`);
  console.log(`name: ${r.name}`);
  console.log(`status: ${r.status}`);
  console.log(`trader verificationStatus: ${r.verificationStatus}`);
  console.log(`image: ${r.image}`);
  console.log(`images: ${r.images}`);
  console.log(`metadata: ${r.metadata}`);
  console.log(`createdAt: ${r.createdAt}`);
});

db.close();
