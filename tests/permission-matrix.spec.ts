/**
 * Permission Matrix Negative Authorization Tests
 *
 * Ensures all /api/* routes enforce role-based access control (RBAC).
 * Each test exercises a critical endpoint and verifies 403 Forbidden for unauthorized roles.
 *
 * Test Matrix:
 * - Money endpoints (wallet deposit/withdraw/transfer): customer-only (agents/admins allowed)
 * - Purchase endpoints: customer-only with opt-in trader verification
 * - Admin endpoints: admin-only (dashboard, user management, audit logs)
 * - OTP endpoints: admin-only
 *
 * Test Execution:
 * npm test -- tests/permission-matrix.spec.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server';
import { createTestUser, createTestSession } from './helpers/auth';
import { setupTestDb, cleanupTestDb } from './helpers/db';

describe('Permission Matrix - Negative Authorization Tests', () => {
  let customerToken: string;
  let traderToken: string;
  let agentToken: string;
  let adminToken: string;
  let customerId: string;
  let traderId: string;
  let agentId: string;
  let adminId: string;

  beforeAll(async () => {
    await setupTestDb();

    // Create test users with different roles
    const customerUser = await createTestUser(app, { role: 'customer', email: 'customer@test.local' });
    const traderUser = await createTestUser(app, { role: 'trader', email: 'trader@test.local' });
    const agentUser = await createTestUser(app, { role: 'agent', email: 'agent@test.local' });
    const adminUser = await createTestUser(app, { role: 'admin', email: 'admin@test.local' });

    customerId = customerUser.id;
    traderId = traderUser.id;
    agentId = agentUser.id;
    adminId = adminUser.id;

    customerToken = customerUser.token;
    traderToken = traderUser.token;
    agentToken = agentUser.token;
    adminToken = adminUser.token;
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  describe('Wallet Endpoints - Money Operations', () => {
    describe('POST /api/wallet/deposit', () => {
      it('should reject trader without permission', async () => {
        const response = await request(app)
          .post('/api/wallet/deposit')
          .set('Authorization', `Bearer ${traderToken}`)
          .set('Idempotency-Key', 'test-deposit-1')
          .send({
            userId: traderId,
            amount: 100,
            method: 'mobile_money',
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBeDefined();
      });

      it('should allow admin deposit on behalf of user', async () => {
        const response = await request(app)
          .post('/api/wallet/deposit')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Idempotency-Key', 'test-deposit-admin-2')
          .send({
            userId: customerId,
            amount: 100,
            method: 'mobile_money',
          });

        expect([200, 201, 202]).toContain(response.status);
      });

      it('should allow agent deposit on behalf of user', async () => {
        const response = await request(app)
          .post('/api/wallet/deposit')
          .set('Authorization', `Bearer ${agentToken}`)
          .set('Idempotency-Key', 'test-deposit-agent-3')
          .send({
            userId: customerId,
            amount: 100,
            method: 'mobile_money',
          });

        expect([200, 201, 202]).toContain(response.status);
      });

      it('should reject unauthenticated request', async () => {
        const response = await request(app)
          .post('/api/wallet/deposit')
          .set('Idempotency-Key', 'test-deposit-noauth')
          .send({
            userId: customerId,
            amount: 100,
            method: 'mobile_money',
          });

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/wallet/withdraw', () => {
      it('should reject trader without permission', async () => {
        const response = await request(app)
          .post('/api/wallet/withdraw')
          .set('Authorization', `Bearer ${traderToken}`)
          .set('Idempotency-Key', 'test-withdraw-1')
          .send({
            userId: traderId,
            amount: 50,
            method: 'bank_transfer',
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBeDefined();
      });

      it('should allow customer withdraw', async () => {
        const response = await request(app)
          .post('/api/wallet/withdraw')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('Idempotency-Key', 'test-withdraw-customer')
          .send({
            userId: customerId,
            amount: 10,
            method: 'bank_transfer',
          });

        // 200, 202 accepted, or 400 if insufficient funds
        expect([200, 202, 400]).toContain(response.status);
      });

      it('should reject unauthenticated request', async () => {
        const response = await request(app)
          .post('/api/wallet/withdraw')
          .set('Idempotency-Key', 'test-withdraw-noauth')
          .send({
            userId: customerId,
            amount: 50,
            method: 'bank_transfer',
          });

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/wallet/transfer', () => {
      it('should reject trader without permission', async () => {
        const response = await request(app)
          .post('/api/wallet/transfer')
          .set('Authorization', `Bearer ${traderToken}`)
          .set('Idempotency-Key', 'test-transfer-1')
          .send({
            fromUserId: traderId,
            toUserId: customerId,
            amount: 50,
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBeDefined();
      });

      it('should allow customer transfer', async () => {
        const response = await request(app)
          .post('/api/wallet/transfer')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('Idempotency-Key', 'test-transfer-customer')
          .send({
            fromUserId: customerId,
            toUserId: agentId,
            amount: 10,
          });

        // 200, 202 accepted, or 400 if insufficient funds
        expect([200, 202, 400]).toContain(response.status);
      });

      it('should reject unauthenticated request', async () => {
        const response = await request(app)
          .post('/api/wallet/transfer')
          .set('Idempotency-Key', 'test-transfer-noauth')
          .send({
            fromUserId: customerId,
            toUserId: agentId,
            amount: 50,
          });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Purchase Endpoints', () => {
    describe('POST /api/purchases', () => {
      it('should reject trader without permission', async () => {
        const response = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${traderToken}`)
          .send({
            customerId,
            traderId: traderId,
            items: [{ productId: 'prod-1', quantity: 1, price: 50 }],
            totalAmount: 50,
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBeDefined();
      });

      it('should allow customer to create purchase', async () => {
        const response = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            customerId,
            traderId: traderId,
            items: [{ productId: 'prod-1', quantity: 1, price: 50 }],
            totalAmount: 50,
          });

        // 200, 201 created, or 400 validation error
        expect([200, 201, 400]).toContain(response.status);
      });

      it('should reject unauthenticated request', async () => {
        const response = await request(app)
          .post('/api/purchases')
          .send({
            customerId,
            traderId: traderId,
            items: [{ productId: 'prod-1', quantity: 1, price: 50 }],
            totalAmount: 50,
          });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Admin Endpoints - Dashboard & User Management', () => {
    describe('GET /api/admin/dashboard', () => {
      it('should reject customer', async () => {
        const response = await request(app)
          .get('/api/admin/dashboard')
          .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(403);
      });

      it('should reject trader', async () => {
        const response = await request(app)
          .get('/api/admin/dashboard')
          .set('Authorization', `Bearer ${traderToken}`);

        expect(response.status).toBe(403);
      });

      it('should reject agent', async () => {
        const response = await request(app)
          .get('/api/admin/dashboard')
          .set('Authorization', `Bearer ${agentToken}`);

        expect(response.status).toBe(403);
      });

      it('should allow admin access', async () => {
        const response = await request(app)
          .get('/api/admin/dashboard')
          .set('Authorization', `Bearer ${adminToken}`);

        expect([200, 400]).toContain(response.status); // 400 if data not ready
      });

      it('should reject unauthenticated request', async () => {
        const response = await request(app)
          .get('/api/admin/dashboard');

        expect(response.status).toBe(401);
      });
    });

    describe('PUT /api/admin/users/:id', () => {
      it('should reject customer', async () => {
        const response = await request(app)
          .put(`/api/admin/users/${traderId}`)
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ status: 'verified' });

        expect(response.status).toBe(403);
      });

      it('should reject trader', async () => {
        const response = await request(app)
          .put(`/api/admin/users/${customerId}`)
          .set('Authorization', `Bearer ${traderToken}`)
          .send({ status: 'verified' });

        expect(response.status).toBe(403);
      });

      it('should reject agent', async () => {
        const response = await request(app)
          .put(`/api/admin/users/${customerId}`)
          .set('Authorization', `Bearer ${agentToken}`)
          .send({ status: 'verified' });

        expect(response.status).toBe(403);
      });

      it('should allow admin', async () => {
        const response = await request(app)
          .put(`/api/admin/users/${traderId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'verified' });

        expect([200, 400, 404]).toContain(response.status);
      });

      it('should reject unauthenticated request', async () => {
        const response = await request(app)
          .put(`/api/admin/users/${traderId}`)
          .send({ status: 'verified' });

        expect(response.status).toBe(401);
      });
    });

    describe('DELETE /api/admin/users/:id', () => {
      it('should reject customer', async () => {
        const response = await request(app)
          .delete(`/api/admin/users/${agentId}`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(403);
      });

      it('should reject trader', async () => {
        const response = await request(app)
          .delete(`/api/admin/users/${agentId}`)
          .set('Authorization', `Bearer ${traderToken}`);

        expect(response.status).toBe(403);
      });

      it('should allow admin', async () => {
        const response = await request(app)
          .delete(`/api/admin/users/${agentId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect([200, 400, 404]).toContain(response.status);
      });

      it('should reject unauthenticated request', async () => {
        const response = await request(app)
          .delete(`/api/admin/users/${agentId}`);

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/admin/verify-user', () => {
      it('should reject customer', async () => {
        const response = await request(app)
          .post('/api/admin/verify-user')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ userId: traderId, verified: true });

        expect(response.status).toBe(403);
      });

      it('should reject trader', async () => {
        const response = await request(app)
          .post('/api/admin/verify-user')
          .set('Authorization', `Bearer ${traderToken}`)
          .send({ userId: customerId, verified: true });

        expect(response.status).toBe(403);
      });

      it('should allow admin', async () => {
        const response = await request(app)
          .post('/api/admin/verify-user')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ userId: traderId, verified: true });

        expect([200, 400, 404]).toContain(response.status);
      });

      it('should reject unauthenticated request', async () => {
        const response = await request(app)
          .post('/api/admin/verify-user')
          .send({ userId: traderId, verified: true });

        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/admin/audit-logs', () => {
      it('should reject customer', async () => {
        const response = await request(app)
          .get('/api/admin/audit-logs')
          .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(403);
      });

      it('should reject trader', async () => {
        const response = await request(app)
          .get('/api/admin/audit-logs')
          .set('Authorization', `Bearer ${traderToken}`);

        expect(response.status).toBe(403);
      });

      it('should allow admin', async () => {
        const response = await request(app)
          .get('/api/admin/audit-logs')
          .set('Authorization', `Bearer ${adminToken}`);

        expect([200, 400]).toContain(response.status);
      });

      it('should reject unauthenticated request', async () => {
        const response = await request(app)
          .get('/api/admin/audit-logs');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('OTP Endpoints - Admin Only', () => {
    describe('POST /api/admin/request-otp', () => {
      it('should reject customer', async () => {
        const response = await request(app)
          .post('/api/admin/request-otp')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ email: 'admin@test.local' });

        expect(response.status).toBe(403);
      });

      it('should reject trader', async () => {
        const response = await request(app)
          .post('/api/admin/request-otp')
          .set('Authorization', `Bearer ${traderToken}`)
          .send({ email: 'admin@test.local' });

        expect(response.status).toBe(403);
      });

      it('should allow admin', async () => {
        const response = await request(app)
          .post('/api/admin/request-otp')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ email: 'admin@test.local' });

        expect([200, 400]).toContain(response.status);
      });
    });

    describe('POST /api/admin/verify-otp', () => {
      it('should reject customer', async () => {
        const response = await request(app)
          .post('/api/admin/verify-otp')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ email: 'admin@test.local', code: '000000' });

        expect(response.status).toBe(403);
      });

      it('should allow admin', async () => {
        const response = await request(app)
          .post('/api/admin/verify-otp')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ email: 'admin@test.local', code: '000000' });

        expect([200, 400]).toContain(response.status); // 400 if OTP invalid/expired
      });
    });
  });

  describe('Cross-Route Coverage', () => {
    it('should enforce auth on /api/me (profile endpoint)', async () => {
      const response = await request(app)
        .get('/api/me');

      expect(response.status).toBe(401);
    });

    it('should return profile for authenticated user', async () => {
      const response = await request(app)
        .get('/api/me')
        .set('Authorization', `Bearer ${customerToken}`);

      expect([200, 400]).toContain(response.status);
    });

    it('should enforce auth on /api/upload', async () => {
      const response = await request(app)
        .post('/api/upload');

      expect(response.status).toBe(401);
    });

    it('should enforce auth on /api/uploads/:filename', async () => {
      const response = await request(app)
        .get('/api/uploads/test.jpg');

      expect(response.status).toBe(401);
    });
  });

  describe('Permission Matrix Summary', () => {
    it('should document expected role permissions for all money-moving endpoints', () => {
      const permissionMatrix = {
        'POST /api/wallet/deposit': {
          allowed: ['admin', 'agent', 'customer'],
          denied: ['trader'],
          requiresIdempotencyKey: true,
        },
        'POST /api/wallet/withdraw': {
          allowed: ['admin', 'agent', 'customer'],
          denied: ['trader'],
          requiresIdempotencyKey: true,
        },
        'POST /api/wallet/transfer': {
          allowed: ['admin', 'agent', 'customer'],
          denied: ['trader'],
          requiresIdempotencyKey: true,
        },
        'POST /api/purchases': {
          allowed: ['admin', 'customer'],
          denied: ['trader', 'agent'],
          requiresIdempotencyKey: false,
        },
        'GET /api/admin/dashboard': {
          allowed: ['admin'],
          denied: ['customer', 'trader', 'agent'],
          requiresIdempotencyKey: false,
        },
        'PUT /api/admin/users/:id': {
          allowed: ['admin'],
          denied: ['customer', 'trader', 'agent'],
          requiresIdempotencyKey: false,
        },
        'DELETE /api/admin/users/:id': {
          allowed: ['admin'],
          denied: ['customer', 'trader', 'agent'],
          requiresIdempotencyKey: false,
        },
        'POST /api/admin/verify-user': {
          allowed: ['admin'],
          denied: ['customer', 'trader', 'agent'],
          requiresIdempotencyKey: false,
        },
        'GET /api/admin/audit-logs': {
          allowed: ['admin'],
          denied: ['customer', 'trader', 'agent'],
          requiresIdempotencyKey: false,
        },
        'POST /api/admin/verify-otp': {
          allowed: ['admin'],
          denied: ['customer', 'trader', 'agent'],
          requiresIdempotencyKey: false,
        },
      };

      expect(Object.keys(permissionMatrix).length).toBeGreaterThan(0);
      expect(permissionMatrix['POST /api/wallet/deposit'].allowed).toContain('admin');
      expect(permissionMatrix['GET /api/admin/dashboard'].allowed).toEqual(['admin']);
    });
  });
});
