const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'data', 'esoko.db');
const db = new Database(dbPath);

const PRODUCT_ID = process.argv[2] || 'df3b165f-8ebf-4344-a5c1-ba314fe36151';

const stmt = db.prepare('UPDATE products SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?');
const info = stmt.run('available', PRODUCT_ID);

console.log(`Updated rows: ${info.changes}`);

const row = db.prepare('SELECT id, traderId, name, status, image, images, metadata, createdAt FROM products WHERE id = ?').get(PRODUCT_ID);
console.log('Result:');
console.log(row);

db.close();
