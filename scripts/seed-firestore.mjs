import fs from "node:fs";
import { initializeApp } from "firebase/app";
import { collection, doc, getDocs, getFirestore, writeBatch } from "firebase/firestore";
import { DEFAULT_PRODUCTS } from "../src/data/defaultProducts.js";

function loadEnv(path = ".env") {
  const env = {};
  const content = fs.readFileSync(path, "utf8");

  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const index = trimmed.indexOf("=");
    if (index === -1) return;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  });

  return env;
}

const env = loadEnv();

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

if (!Object.values(firebaseConfig).every(Boolean)) {
  throw new Error("Faltan variables Firebase en .env");
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const productosRef = collection(db, "iceScroll", "main", "productos");

async function commitInChunks(items, chunkSize = 400) {
  for (let index = 0; index < items.length; index += chunkSize) {
    const batch = writeBatch(db);
    items.slice(index, index + chunkSize).forEach((product) => {
      batch.set(doc(productosRef, product.id), {
        ...product,
        updatedAt: Date.now(),
      }, { merge: true });
    });
    await batch.commit();
  }
}

await commitInChunks(DEFAULT_PRODUCTS);

const snapshot = await getDocs(productosRef);
console.log(`Productos cargados/verificados en Firestore: ${snapshot.size}`);
console.log(`Proyecto Firebase: ${firebaseConfig.projectId}`);
console.log("Ruta: iceScroll/main/productos");
process.exit(0);
