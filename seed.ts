import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import db from './db.ts';
import { runPendingMigrations } from './lib/migrations.ts';
import path from 'path';

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function upsertUser(user: {
  id: string;
  email: string;
  name: string;
  password: string;
  role: string;
  walletBalance: number;
  appNumber: string;
  businessName?: string;
  businessCategory?: string;
  location?: string;
  phone?: string;
  tin?: string;
}) {
  db.prepare(
    `
    INSERT INTO users (
      id, email, name, password, role, verificationStatus, walletBalance, appNumber,
      tier, phone, businessName, businessCategory, location, tin, onboardingComplete,
      loyaltyPoints, emailVerified, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, 'verified', ?, ?, 'free', ?, ?, ?, ?, ?, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      password = excluded.password,
      role = excluded.role,
      verificationStatus = 'verified',
      walletBalance = excluded.walletBalance,
      appNumber = excluded.appNumber,
      phone = excluded.phone,
      businessName = excluded.businessName,
      businessCategory = excluded.businessCategory,
      location = excluded.location,
      tin = excluded.tin,
      emailVerified = 1,
      updatedAt = CURRENT_TIMESTAMP
  `
  ).run(
    user.id,
    user.email,
    user.name,
    hashPassword(user.password),
    user.role,
    user.walletBalance,
    user.appNumber,
    user.phone || null,
    user.businessName || null,
    user.businessCategory || null,
    user.location || null,
    user.tin || null
  );
}

function upsertProduct(product: {
  id: string;
  traderId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  code: string;
}) {
  db.prepare(
    `
    INSERT INTO products (id, traderId, name, description, category, price, stock, status, code, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      category = excluded.category,
      price = excluded.price,
      stock = excluded.stock,
      status = 'available',
      code = excluded.code,
      updatedAt = CURRENT_TIMESTAMP
  `
  ).run(
    product.id,
    product.traderId,
    product.name,
    product.description,
    product.category,
    product.price,
    product.stock,
    product.code
  );
}

function insertNotification(userId: string, title: string, message: string) {
  db.prepare(
    `
    INSERT INTO notifications (id, userId, title, message, type, subType, read, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 'info', 'system', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(uuidv4(), userId, title, message);
}

const users = [
  {
    id: 'admin-demo',
    email: 'admin@esoko.rw',
    name: 'Esoko Admin',
    password: 'admin123',
    role: 'admin',
    walletBalance: 0,
    appNumber: '10000001',
    phone: '+250780000001',
    location: 'Kigali',
  },
  {
    id: 'trader-demo-1',
    email: 'trader1@esoko.rw',
    name: 'Aline Market',
    password: 'trader123',
    role: 'trader',
    walletBalance: 125000,
    appNumber: '20000001',
    businessName: 'Aline Fresh Foods',
    businessCategory: 'Groceries',
    location: 'Kimironko Market',
    phone: '+250780000002',
    tin: 'TIN-DEMO-001',
  },
  {
    id: 'trader-demo-2',
    email: 'trader2@esoko.rw',
    name: 'Baho Supplies',
    password: 'trader123',
    role: 'trader',
    walletBalance: 83000,
    appNumber: '20000002',
    businessName: 'Baho Home Supplies',
    businessCategory: 'Household',
    location: 'Nyamirambo',
    phone: '+250780000003',
    tin: 'TIN-DEMO-002',
  },
  {
    id: 'customer-demo-1',
    email: 'customer1@esoko.rw',
    name: 'Jean Customer',
    password: 'customer123',
    role: 'customer',
    walletBalance: 75000,
    appNumber: '30000001',
    phone: '+250780000004',
    location: 'Remera',
  },
  {
    id: 'agent-demo-1',
    email: 'agent1@esoko.rw',
    name: 'Nexus Agent',
    password: 'agent123',
    role: 'agent',
    walletBalance: 500000,
    appNumber: '40000001',
    phone: '+250780000005',
    location: 'Kigali Heights',
  },
];

const products = [
  {
    id: 'product-rice',
    traderId: 'trader-demo-1',
    name: 'Premium Rice 5kg',
    description: 'Locally stocked rice for families and restaurants.',
    category: 'Groceries',
    price: 7800,
    stock: 32,
    code: 'RICE-5KG',
  },
  {
    id: 'product-beans',
    traderId: 'trader-demo-1',
    name: 'Red Beans 2kg',
    description: 'Fresh red beans from Eastern Province suppliers.',
    category: 'Groceries',
    price: 3200,
    stock: 46,
    code: 'BEANS-2KG',
  },
  {
    id: 'product-oil',
    traderId: 'trader-demo-1',
    name: 'Cooking Oil 3L',
    description: 'Everyday cooking oil for retail customers.',
    category: 'Groceries',
    price: 9500,
    stock: 19,
    code: 'OIL-3L',
  },
  {
    id: 'product-soap',
    traderId: 'trader-demo-2',
    name: 'Laundry Soap Pack',
    description: 'A value pack for household washing.',
    category: 'Household',
    price: 4200,
    stock: 27,
    code: 'SOAP-PACK',
  },
  {
    id: 'product-solar',
    traderId: 'trader-demo-2',
    name: 'Solar Lamp',
    description: 'Rechargeable lamp for homes and small shops.',
    category: 'Electronics',
    price: 18500,
    stock: 12,
    code: 'SOLAR-LAMP',
  },
];

(async () => {
  // Run pending migrations first
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const result = await runPendingMigrations(db, migrationsDir);
  if (!result.success) {
    console.error('Failed to run migrations:', result.errors);
    process.exit(1);
  }
  if (result.migrationCount > 0) {
    console.log(`✓ Ran ${result.migrationCount} migration(s)`);
  }

  db.transaction(() => {
    users.forEach(upsertUser);
    products.forEach(upsertProduct);

    const existingPurchases = (db.prepare('SELECT COUNT(*) as count FROM purchases').get() as any)
      .count;
    if (existingPurchases === 0) {
      const purchaseId = uuidv4();
      db.prepare(
        `
        INSERT INTO purchases (id, customerId, traderId, productId, quantity, totalAmount, status, deliveryStatus, paymentStatus, createdAt, updatedAt)
        VALUES (?, 'customer-demo-1', 'trader-demo-1', 'product-rice', 1, 7800, 'approved', 'pending', 'paid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      ).run(purchaseId);

      db.prepare(
        `
        INSERT INTO transactions (id, userId, senderId, recipientId, customerId, traderId, amount, type, status, description, transactionCode, reference, createdAt, updatedAt, timestamp)
        VALUES (?, 'customer-demo-1', 'customer-demo-1', 'trader-demo-1', 'customer-demo-1', 'trader-demo-1', 7800, 'purchase', 'completed', 'Seed purchase: Premium Rice 5kg', 'PAY-SEED-001', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      ).run(uuidv4(), purchaseId);
    }

    users.forEach((user) => {
      db.prepare(
        `
        INSERT OR IGNORE INTO loyalty_points (id, userId, points, totalEarned, updatedAt)
        VALUES (?, ?, 0, 0, CURRENT_TIMESTAMP)
      `
      ).run(uuidv4(), user.id);
    });

    // Seed vouchers
    function seedVouchers() {
      if ((db.prepare('SELECT COUNT(*) as count FROM vouchers').get() as any).count > 0) {
        return; // Already seeded
      }

      const vouchers = [
        {
          id: uuidv4(),
          code: 'WELCOME-5000',
          amount: 5000,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: uuidv4(),
          code: 'SUMMER-10000',
          amount: 10000,
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      vouchers.forEach((v) => {
        db.prepare(
          `
          INSERT INTO vouchers (id, code, amount, issuer, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `
        ).run(v.id, v.code, v.amount, 'platform', v.expires_at, new Date().toISOString());
      });

      console.log('✓ Vouchers seeded');
    }

    // Seed trader accounts
    function seedTraderAccounts() {
      if ((db.prepare('SELECT COUNT(*) as count FROM trader_accounts').get() as any).count > 0) {
        return;
      }

      const traders = [
        { trader_id: 'trader-demo-1', balance: 50000, total_earned: 150000 },
        { trader_id: 'trader-demo-2', balance: 75000, total_earned: 200000 },
      ];

      traders.forEach((t) => {
        db.prepare(
          `
          INSERT INTO trader_accounts (id, trader_id, balance, total_earned, created_at)
          VALUES (?, ?, ?, ?, ?)
        `
        ).run(uuidv4(), t.trader_id, t.balance, t.total_earned, new Date().toISOString());
      });

      console.log('✓ Trader accounts seeded');
    }

    seedVouchers();
    seedTraderAccounts();

    insertNotification(
      'customer-demo-1',
      'Seed data ready',
      'Your demo customer wallet and marketplace are ready.'
    );
    insertNotification(
      'trader-demo-1',
      'Inventory loaded',
      'Your demo products are available for customer purchases.'
    );
  })();

  console.log('Seed complete.');
  console.log('Admin:    admin@esoko.rw / admin123');
  console.log('Trader:   trader1@esoko.rw / trader123');
  console.log('Customer: customer1@esoko.rw / customer123');
  console.log('Agent:    agent1@esoko.rw / agent123');
})();
