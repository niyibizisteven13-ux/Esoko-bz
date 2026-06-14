# Firebase to Backend API Migration Guide

## Quick Start: Using the Firestore Bridge

The `src/services/firestoreBridge.ts` provides drop-in replacements for Firebase Firestore functions. No component changes needed!

### Before (Firebase):
```typescript
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';

// Query products
const q = query(
  collection(db, 'products'),
  where('traderId', '==', userId)
);
const snapshot = await getDocs(q);
const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

### After (Firestore Bridge):
```typescript
// SAME CODE - just change the import!
import { collection, addDoc, getDocs, query, where } from '../../services/firestoreBridge';
import { db } from '../../firebase'; // Still works, db can be null/undefined

// Query products
const q = query(
  collection(db, 'products'),
  where('traderId', '==', userId)
);
const snapshot = await getDocs(q);
const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

## API Endpoints Available

### Products
- `GET /api/products` - List all products with filters
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Users
- `GET /api/users` - List users
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user
- `GET /api/users/search?query=...` - Search users

### Transactions
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction

### Purchases
- `GET /api/purchases` - List purchases
- `POST /api/purchases` - Create purchase
- `PUT /api/purchases/:id` - Update purchase status

### Deliveries
- `GET /api/deliveries` - List deliveries
- `POST /api/deliveries` - Create delivery
- `PUT /api/deliveries/:id` - Update delivery

### Notifications
- `GET /api/notifications` - Get notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/:id` - Mark as read

### Wallets
- `GET /api/wallets/:userId` - Get wallet balance
- `POST /api/wallets/transfer` - Transfer funds
- `POST /api/wallets/topup` - Top up wallet

## Supported Query Constraints

```typescript
import { query, collection, where, orderBy, limit } from '../../services/firestoreBridge';

// All these work exactly like Firestore:
where('fieldName', '==', value)
where('fieldName', '!=', value)
where('fieldName', '<', value)
where('fieldName', '<=', value)
where('fieldName', '>', value)
where('fieldName', '>=', value)

orderBy('fieldName', 'asc' | 'desc')
limit(10)
```

## Features Supported

✅ **Query Operations**
- `getDocs()` - Fetch multiple documents
- `getDoc()` - Fetch single document
- `addDoc()` - Create new document
- `updateDoc()` - Update document
- `setDoc()` - Create or overwrite document
- `deleteDoc()` - Delete document
- `query()` with `where`, `orderBy`, `limit`

✅ **Transactions & Batches**
- `runTransaction()` - Execute transaction
- `writeBatch()` - Batch write operations

✅ **Utilities**
- `serverTimestamp()` - Current timestamp
- `Timestamp()` - Date constructor
- `increment()` - Atomic increment
- `onSnapshot()` - Real-time listeners (polls every 3s)

## File Uploads (Firebase Storage Replacement)

### Before (Firebase Storage):
```typescript
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

const fileRef = ref(storage, `products/${productId}/${file.name}`);
const result = await uploadBytes(fileRef, file);
const url = await getDownloadURL(result.ref);
```

### After (Backend API):
```typescript
// Use FormData with apiClient
import { apiPost } from '../../services/apiClient';

const formData = new FormData();
formData.append('file', file);
formData.append('productId', productId);

const response = await apiPost<{ url: string }>('/api/upload', formData);
const url = response.url;
```

## Test Users (After Running `npm run seed`)

```
Admin:    admin@esoko.rw / admin123
Trader:   trader1@esoko.rw / trader123
Customer: customer1@esoko.rw / customer123
Agent:    agent1@esoko.rw / agent123
```

## Migration Path (No Breaking Changes!)

1. **Phase 1**: Keep existing Firebase imports working
2. **Phase 2**: Components gradually import from `firestoreBridge` instead
3. **Phase 3**: Remove Firebase dependencies entirely

Because the bridge provides Firestore-compatible APIs that map to backend endpoints, **no component logic needs to change** - only imports!

## Common Patterns

### Get all products for a trader
```typescript
import { query, collection, where, getDocs } from '../../services/firestoreBridge';

const q = query(collection(undefined, 'products'), where('traderId', '==', traderId));
const snap = await getDocs(q);
const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
```

### Create a product
```typescript
import { collection, addDoc } from '../../services/firestoreBridge';

const colRef = collection(undefined, 'products');
const docRef = await addDoc(colRef, {
  name: 'Product Name',
  price: 5000,
  traderId: userId,
  stock: 100,
});
```

### Update a document
```typescript
import { doc, updateDoc } from '../../services/firestoreBridge';

const docRef = doc(undefined, 'products', productId);
await updateDoc(docRef, { stock: 50, price: 6000 });
```

### Listen for changes (polling)
```typescript
import { collection, query, where, onSnapshot } from '../../services/firestoreBridge';

const q = query(collection(undefined, 'products'), where('traderId', '==', userId));
const unsubscribe = onSnapshot(q, (snapshot) => {
  const products = snapshot.docs.map(d => d.data());
  console.log('Products updated:', products);
});

// Later: unsubscribe();
```

## Performance Considerations

1. **Real-time updates** use polling (3-second intervals)
   - Works everywhere, no WebSocket setup needed
   - For high-frequency updates, use `apiClient` directly

2. **Batch operations** execute sequentially
   - Not atomic like Firebase
   - For critical operations, use backend transactions

3. **Query filters** are URL parameters
   - Server-side filtering not yet implemented
   - Simple filtering works, complex queries may need API updates

## Troubleshooting

**"Collection not found"** → Add collection to `COLLECTION_ROUTES` in `firestoreBridge.ts`

**"Can't upload file"** → Add `/api/upload` endpoint to server.ts

**"Real-time updates not working"** → Using polling; check network tab for 3-second interval requests

**"Query with multiple constraints not working"** → Add backend support by updating query parameter handling
