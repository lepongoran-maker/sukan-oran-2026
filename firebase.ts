import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const requiredEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const missingEnv = Object.entries(requiredEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingEnv.length > 0) {
  throw new Error(`Firebase config is missing: ${missingEnv.join(', ')}`);
}

const firebaseConfig = {
  apiKey: requiredEnv.apiKey,
  authDomain: requiredEnv.authDomain,
  projectId: requiredEnv.projectId,
  storageBucket: requiredEnv.storageBucket,
  messagingSenderId: requiredEnv.messagingSenderId,
  appId: requiredEnv.appId
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, { experimentalForceLongPolling: true });
