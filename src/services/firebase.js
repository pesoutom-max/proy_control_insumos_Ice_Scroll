import { initializeApp } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  addDoc,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseReady = Object.values(firebaseConfig).every(Boolean);

const app = firebaseReady ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;

const productosRef = () => collection(db, "iceScroll", "main", "productos");
const movimientosRef = () => collection(db, "iceScroll", "main", "movimientos");

export function useFirebaseData() {
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!db) return;
    setLoadingData(true);
    setError("");

    const unsubProductos = onSnapshot(
      query(productosRef(), orderBy("nombre")),
      (snapshot) => {
        setProductos(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoadingData(false);
      },
      (err) => {
        setError(err.message);
        setLoadingData(false);
      },
    );

    const unsubMovimientos = onSnapshot(
      query(movimientosRef(), orderBy("createdAt", "desc")),
      (snapshot) => setMovimientos(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (err) => setError(err.message),
    );

    return () => {
      unsubProductos();
      unsubMovimientos();
    };
  }, []);

  return useMemo(
    () => ({ productos, movimientos, loadingData, firebaseReady, error }),
    [productos, movimientos, loadingData, error],
  );
}

export function updateProducto(id, data) {
  return setDoc(doc(productosRef(), id), data, { merge: true });
}

export function deleteProducto(id) {
  return deleteDoc(doc(productosRef(), id));
}

export function addMovimiento(data) {
  return addDoc(movimientosRef(), data);
}

export async function seedDefaultProducts(products) {
  const batch = writeBatch(db);
  products.forEach((product) => {
    batch.set(doc(productosRef(), product.id), product, { merge: true });
  });
  await batch.commit();
}
