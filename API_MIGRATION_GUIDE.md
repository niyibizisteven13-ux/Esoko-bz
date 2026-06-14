# REST API Migration Guide & Testing

## Overview

This document provides guidance for migrating Esoko Nexus components from Firebase to REST APIs and instructions for testing all endpoints.

## Architecture

### Backend Server
- **Framework**: Express.js with TypeScript
- **Database**: SQLite (better-sqlite3)
- **Authentication**: JWT tokens
- **Host**: `http://localhost:5173` (development)

### Key Features
- No Firebase/Google Cloud dependencies
- Local SQLite database with WAL mode for concurrency
- JWT-based authentication
- Transaction support for atomic operations
- Comprehensive error handling

## Database Seeding

### Run the seeding script:
```bash
npm run seed
# or
npx ts-node seed.ts
```

### Generated Sample Data:
- 1 Admin user
- 5 Traders with products
- 10 Customers
- 40+ Purchases
- 30+ Deliveries
- 100+ Transactions
- Loyalty points initialization

### Test Credentials:
```
Admin:    admin@esoko.rw / admin123
Trader:   trader1@esoko.rw / trader123
Customer: customer1@esoko.rw / customer123
```

## API Endpoints Reference

### Authentication Endpoints

#### Login
```
POST /api/auth/login
Body: { email, password }
Response: { success, user, token }
```

#### Register
```
POST /api/auth/register
Body: { email, password, name, role }
Response: { success, user, token }
```

#### Logout
```
POST /api/auth/logout
Headers: Authorization: Bearer <token>
Response: { success }
```

### Wallet Endpoints

#### Get Wallet
```
GET /api/wallet/:userId
Headers: Authorization: Bearer <token>
Response: { 
  success, 
  wallet: { 
    balance, 
    loyaltyPoints, 
    transactions,
    currency 
  } 
}
```

#### Deposit
```
POST /api/wallet/deposit
Body: { userId, amount, method }
Response: { success, transactionId, message }
```

#### Withdraw
```
POST /api/wallet/withdraw
Body: { userId, amount, method }
Response: { success, transactionId, message }
```

#### Transfer (P2P)
```
POST /api/wallet/transfer
Body: { senderId, recipientId, amount }
Response: { success, transactionId, message }
```

#### Redeem Loyalty Points
```
POST /api/wallet/loyalty/redeem
Body: { userId, points }
Response: { success, transactionId, redemptionValue }
```

#### Get Loans
```
GET /api/wallet/loans/:userId?status=pending
Response: { success, loans: [...] }
```

#### Apply for Loan
```
POST /api/wallet/loans/apply
Body: { userId, amount, loanTerm }
Response: { success, loanId, monthlyPayment, totalRepayment }
```

### User Endpoints

#### Get User
```
GET /api/users/:id
Response: { success, user }
```

#### Update User
```
PUT /api/users/:id
Body: { name, businessName, tier, verificationStatus, walletBalance }
Response: { success, user }
```

#### List Users
```
GET /api/users?limit=50&offset=0&role=trader&status=verified
Response: { success, users }
```

### Product Endpoints

#### List Products
```
GET /api/products?traderId=xxx&category=xxx&limit=50
Response: { success, products }
```

#### Create Product
```
POST /api/products
Body: { traderId, name, description, category, price, stock, image }
Response: { success, id }
```

#### Update Product
```
PUT /api/products/:id
Body: { name, description, price, stock, status }
Response: { success }
```

#### Delete Product
```
DELETE /api/products/:id
Response: { success }
```

### Purchase Endpoints

#### List Purchases
```
GET /api/purchases?customerId=xxx&traderId=xxx
Response: { success, purchases }
```

#### Create Purchase
```
POST /api/purchases
Body: { customerId, traderId, productId, quantity, totalAmount }
Response: { success, id }
```

#### Update Purchase
```
PUT /api/purchases/:id
Body: { status, deliveryStatus, paymentStatus }
Response: { success }
```

### Admin Endpoints

#### Dashboard Stats
```
GET /api/admin/dashboard
Headers: Authorization: Bearer <admin-token>
Response: {
  success,
  dashboard: {
    totalUsers,
    totalTransactions,
    totalTransactionValue,
    totalProducts,
    completedPurchases,
    averageTransaction
  }
}
```

#### List All Users
```
GET /api/admin/users?role=trader&status=verified&search=query
Headers: Authorization: Bearer <admin-token>
Response: { success, users }
```

#### Update User
```
PUT /api/admin/users/:id
Headers: Authorization: Bearer <admin-token>
Body: { role, verificationStatus, tier, walletBalance }
Response: { success }
```

#### Delete User
```
DELETE /api/admin/users/:id
Headers: Authorization: Bearer <admin-token>
Response: { success }
```

#### Verify User
```
POST /api/admin/verify-user
Headers: Authorization: Bearer <admin-token>
Body: { userId }
Response: { success }
```

#### List All Transactions
```
GET /api/admin/transactions?status=completed&type=purchase
Headers: Authorization: Bearer <admin-token>
Response: { success, transactions }
```

#### Maintenance Mode
```
POST /api/admin/system/maintenance
Headers: Authorization: Bearer <admin-token>
Body: { enabled, broadcast }
Response: { success }
```

#### Audit Logs
```
GET /api/admin/audit-logs?limit=100
Headers: Authorization: Bearer <admin-token>
Response: { success, logs }
```

## Component Migration Examples

### Example 1: WalletComponent Migration

**Before (Firebase):**
```typescript
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

const getWallet = async (userId: string) => {
  const q = query(collection(db, 'wallets'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs[0]?.data();
};
```

**After (REST API):**
```typescript
import { walletService } from '../services/walletService';

const getWallet = async (userId: string) => {
  const wallet = await walletService.getWallet(userId);
  return wallet;
};
```

### Example 2: Marketplace Migration

**Before (Firebase):**
```typescript
const products = await getDocs(query(
  collection(db, 'products'),
  where('traderId', '==', traderId)
));
```

**After (REST API):**
```typescript
const response = await apiGet('/api/products', {
  params: { traderId }
});
```

### Example 3: Deposit Operation

**Before (Firebase):**
```typescript
await updateDoc(doc(db, 'wallets', walletId), {
  balance: increment(amount)
});
await addDoc(collection(db, 'transactions'), {
  userId, amount, type: 'deposit'
});
```

**After (REST API):**
```typescript
const result = await walletService.deposit(userId, amount, 'mobile_money');
```

## Testing Guide

### 1. Setup

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Seed database with sample data
npm run seed

# Start development server
npm run dev
```

### 2. Test Authentication

```bash
# Test login
curl -X POST http://localhost:5173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer1@esoko.rw","password":"customer123"}'

# Test register
curl -X POST http://localhost:5173/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@esoko.rw","password":"pass123","name":"New User","role":"customer"}'
```

### 3. Test Wallet Operations

```bash
# Get wallet (requires token)
TOKEN="<jwt-token-from-login>"
curl -X GET http://localhost:5173/api/wallet/USER_ID \
  -H "Authorization: Bearer $TOKEN"

# Deposit
curl -X POST http://localhost:5173/api/wallet/deposit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","amount":50000,"method":"mobile_money"}'

# Transfer
curl -X POST http://localhost:5173/api/wallet/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"senderId":"SENDER_ID","recipientId":"RECIPIENT_ID","amount":10000}'
```

### 4. Test Product Operations

```bash
# List products
curl -X GET "http://localhost:5173/api/products?traderId=TRADER_ID" \
  -H "Authorization: Bearer $TOKEN"

# Create product
curl -X POST http://localhost:5173/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "traderId":"TRADER_ID",
    "name":"Rice",
    "description":"White rice",
    "category":"Grains",
    "price":15000,
    "stock":100
  }'
```

### 5. Test Admin Operations

```bash
# Admin login
ADMIN_TOKEN="<admin-token>"

# Get dashboard
curl -X GET http://localhost:5173/api/admin/dashboard \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# List users
curl -X GET "http://localhost:5173/api/admin/users?role=trader" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Verify user
curl -X POST http://localhost:5173/api/admin/verify-user \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID"}'
```

## Performance Tips

1. **Use Indexes**: Database includes indices on frequently queried fields
2. **Limit Results**: Always use pagination with limit/offset
3. **Cache**: Consider caching wallet balance in React state
4. **Batch Operations**: Group multiple updates in transactions

## Error Handling

All endpoints return consistent error responses:
```json
{
  "success": false,
  "error": "Descriptive error message"
}
```

Common error codes:
- 401: Unauthorized (invalid token)
- 403: Forbidden (insufficient permissions)
- 404: Not found
- 400: Bad request (validation error)
- 500: Server error

## Security Considerations

1. **JWT Tokens**: 7-day expiration
2. **HTTPS**: Use HTTPS in production
3. **CORS**: Configure appropriately for frontend domain
4. **Admin Role**: Enforce admin verification for sensitive operations
5. **Rate Limiting**: Consider implementing in production

## Deployment

1. Build TypeScript: `npm run build`
2. Set environment variables (JWT_SECRET, PORT, NODE_ENV)
3. Initialize database: `npm run seed`
4. Start server: `npm start`

## Troubleshooting

### Database Connection Issues
- Ensure `data/` directory exists and is writable
- Check SQLite file permissions
- Verify database path in db.ts

### Authentication Failures
- Verify JWT_SECRET environment variable is set
- Check token expiration (7 days)
- Ensure Authorization header format: `Bearer <token>`

### Admin Access Denied
- Verify user role is 'admin'
- Check admin user exists in database
- Login with admin credentials

## Next Steps

1. Migrate remaining components to use REST APIs
2. Add WebSocket support for real-time updates
3. Implement rate limiting
4. Add comprehensive logging
5. Set up automated testing suite
6. Configure production deployment
