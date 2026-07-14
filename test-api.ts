import db from './db.ts';

const BASE_URL = process.env.API_URL || 'http://localhost:5173';

let token = '';
let adminToken = '';
let userId = '';
let productId = '';
let passed = 0;
let failed = 0;
const localDb = db;

async function request(path: string, options: RequestInit = {}) {
  const response = await requestRaw(path, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

async function getCsrfToken(authToken: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/csrf-token`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body.token;
}

async function requestRaw(path: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  return response;
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error: any) {
    failed += 1;
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

await test('health check', async () => {
  const data = await request('/api/health');
  if (data.firebase !== false) throw new Error('Backend should report firebase=false');
});

await test('login seeded customer', async () => {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'customer1@esoko.rw', password: 'customer123' }),
  });
  token = data.token;
  userId = data.user.id;
  if (!token || !userId) throw new Error('Missing token or user');
  localDb
    .prepare(
      `
    UPDATE login_alerts
    SET status = 'confirmed', decisionAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE userId = ? AND status = 'pending'
  `
    )
    .run(userId);
});

await test('login seeded admin', async () => {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@esoko.rw', password: 'admin123' }),
  });
  adminToken = data.token;
  if (!adminToken) throw new Error('Missing admin token');
  localDb
    .prepare(
      `
    UPDATE login_alerts
    SET status = 'confirmed', decisionAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE userId = ? AND status = 'pending'
  `
    )
    .run(data.user.id);
});

await test('load current user', async () => {
  const data = await request('/api/me');
  if (data.user.id !== userId) throw new Error('Wrong current user');
});

await test('load marketplace products', async () => {
  const data = await request('/api/products?limit=5');
  productId =
    data.products.find((product: any) => product.id === 'product-rice')?.id ||
    data.products.find((product: any) => Number(product.price) <= 25000 && Number(product.stock) > 0)
      ?.id ||
    data.products[0]?.id;
  if (!productId) throw new Error('No products returned. Run npm run seed first.');
});

await test('deposit to wallet', async () => {
  const csrfToken = await getCsrfToken(token);
  const data = await request('/api/wallet/deposit', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ userId, amount: 25000, method: 'cash' }),
  });
  if (!data.success) throw new Error('Deposit failed');
});

await test('wallet deposit idempotency', async () => {
  const key = `api-test-deposit-${Date.now()}`;
  const before = await request(`/api/wallet/${userId}`);
  
  const csrfToken1 = await getCsrfToken(adminToken);
  const first = await request('/api/wallet/deposit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Idempotency-Key': key, 'X-CSRF-Token': csrfToken1 },
    body: JSON.stringify({ userId, amount: 777, method: 'cash' }),
  });
  
  const csrfToken2 = await getCsrfToken(adminToken);
  const second = await request('/api/wallet/deposit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Idempotency-Key': key, 'X-CSRF-Token': csrfToken2 },
    body: JSON.stringify({ userId, amount: 777, method: 'cash' }),
  });
  const after = await request(`/api/wallet/${userId}`);

  if (first.transactionId !== second.transactionId) {
    throw new Error('Repeated idempotent deposit returned a different transaction');
  }

  const balanceDelta = after.wallet.balance - before.wallet.balance;
  if (Math.abs(balanceDelta - first.netAmount) > 0.01) {
    throw new Error('Repeated idempotent deposit changed balance more than once');
  }
});

await test('idempotency key cannot be reused across routes', async () => {
  const key = `api-test-conflict-${Date.now()}`;
  const csrfToken = await getCsrfToken(token);
  await request('/api/wallet/deposit', {
    method: 'POST',
    headers: { 'Idempotency-Key': key, 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ userId, amount: 500, method: 'cash' }),
  });

  const response = await requestRaw('/api/purchases', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ productId, quantity: 1 }),
  });

  if (response.status !== 409) {
    throw new Error(`Expected idempotency conflict, got HTTP ${response.status}`);
  }
});

await test('admin wallet adjustment creates transaction ledger trail', async () => {
  const data = await request(`/api/admin/users/${userId}/wallet-adjust`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      amount: 123,
      type: 'admin_credit',
      description: 'API test admin ledger adjustment',
    }),
  });

  if (!data.transactionId) throw new Error('Missing admin adjustment transaction id');

  const transaction = localDb
    .prepare('SELECT * FROM transactions WHERE id = ? AND type = ?')
    .get(data.transactionId, 'admin_adjustment') as any;
  if (!transaction) throw new Error('Admin adjustment transaction was not recorded');

  const ledger = localDb
    .prepare(
      `
      SELECT * FROM ledger_entries
      WHERE transactionId = ? AND accountId = 'wallet_liability' AND direction = 'credit'
    `
    )
    .get(data.transactionId) as any;
  if (!ledger) throw new Error('Admin adjustment ledger entry was not recorded');
});

await test('buy a product', async () => {
  const data = await request('/api/purchases', {
    method: 'POST',
    headers: { 'Idempotency-Key': `api-test-purchase-${Date.now()}` },
    body: JSON.stringify({ productId, quantity: 1 }),
  });
  if (!data.purchaseId) throw new Error('Purchase id missing');
});

await test('create support ticket', async () => {
  const data = await request('/api/tickets', {
    method: 'POST',
    body: JSON.stringify({
      title: 'API test ticket',
      description: 'Created by the local API smoke test.',
    }),
  });
  if (!data.id) throw new Error('Ticket id missing');
});

console.log(`\n${passed} passed, ${failed} failed`);
localDb.close();
if (failed > 0) process.exit(1);
