/**
 * Example: Migrating TraderProducts to use firestoreBridge instead of Firebase
 *
 * This file shows the minimal changes needed to replace Firebase with backend API
 * Changes:
 * 1. Replace firebase imports with firestoreBridge
 * 2. Remove storage/upload code (use new /api/upload endpoint instead)
 * 3. Everything else stays the same!
 */

// BEFORE:
// import { db, storage, auth } from '../../firebase';
// import { collection, query, where, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
// import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// AFTER:
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from '../../services/firestoreBridge';
import { apiPost } from '../../services/apiClient';

// db is now optional/unused
const db = undefined;
const auth = { currentUser: { uid: localStorage.getItem('auth_user_id') } };

/**
 * Example: Replace Firebase storage upload with backend endpoint
 */
export async function uploadProductImage(file: File, productId: string): Promise<string> {
  // OLD Firebase code:
  // const fileRef = ref(storage, `products/${productId}/${file.name}`);
  // const result = await uploadBytes(fileRef, file);
  // return await getDownloadURL(result.ref);

  // NEW backend API code:
  const formData = new FormData();
  formData.append('file', file);
  formData.append('productId', productId);

  try {
    const response = await apiPost<{ url: string }>('/api/upload', formData);
    return response.url;
  } catch (error) {
    console.error('Image upload failed:', error);
    throw error;
  }
}

/**
 * Example: Add a product (unchanged logic, just different data source)
 */
export async function addProductToFirestore(
  traderId: string,
  productData: { name: string; price: number; stock: number; description: string }
) {
  // This code is IDENTICAL to Firebase version
  const colRef = collection(db, 'products');

  const newDocRef = await addDoc(colRef, {
    name: productData.name,
    price: productData.price,
    stock: productData.stock,
    description: productData.description,
    traderId: traderId,
    status: 'available',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return newDocRef.id;
}

/**
 * Example: Get products with query (unchanged)
 */
export async function getTraderProducts(traderId: string) {
  // This code is IDENTICAL to Firebase version
  const q = query(collection(db, 'products'), where('traderId', '==', traderId));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Example: Real-time listener (unchanged, but now polls instead of WebSocket)
 */
export function listenToProductChanges(traderId: string, callback: (products: any[]) => void) {
  // This code is IDENTICAL to Firebase version
  const q = query(collection(db, 'products'), where('traderId', '==', traderId));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(products);
  });

  return unsubscribe;
}

/**
 * Example: Update product (unchanged)
 */
export async function updateProduct(productId: string, updates: any) {
  // This code is IDENTICAL to Firebase version
  const docRef = doc(db, 'products', productId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Example: Delete product (unchanged)
 */
export async function deleteProduct(productId: string) {
  // This code is IDENTICAL to Firebase version
  const docRef = doc(db, 'products', productId);
  await deleteDoc(docRef);
}

/**
 * Example: Complex transaction (unchanged)
 */
export async function buyProductTransaction(
  customerId: string,
  traderId: string,
  productId: string,
  quantity: number,
  totalPrice: number
) {
  // This code is IDENTICAL to Firebase version
  return await runTransaction(db, async (transaction) => {
    // Get product
    const productRef = doc(db, 'products', productId);
    const productSnap = await transaction.get(productRef);

    if (!productSnap.exists()) {
      throw new Error('Product not found');
    }

    const product = productSnap.data();
    if (product.stock < quantity) {
      throw new Error('Not enough stock');
    }

    // Update product stock
    transaction.update(productRef, {
      stock: product.stock - quantity,
      updatedAt: serverTimestamp(),
    });

    // Create purchase record
    const purchaseRef = doc(db, 'purchases', Math.random().toString(36).slice(2));
    transaction.set(purchaseRef, {
      customerId,
      traderId,
      productId,
      quantity,
      totalPrice,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return purchaseRef.id;
  });
}

export default {
  uploadProductImage,
  addProductToFirestore,
  getTraderProducts,
  listenToProductChanges,
  updateProduct,
  deleteProduct,
  buyProductTransaction,
};
