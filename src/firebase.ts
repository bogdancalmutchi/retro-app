import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import {
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence
} from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app);

if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  console.info('Firebase: using local emulators (auth 9099, firestore 8080, functions 5001)');
}

// Sessions live in sessionStorage rather than localStorage, so closing the
// browser signs the user out. The default persistence keeps someone signed in
// indefinitely, which is not what you want on a shared machine.
//
// Awaited before signing in (see AuthPageComponent) so a sign-in can never be
// stored under the previous persistence.
const authPersistenceReady = setPersistence(auth, browserSessionPersistence).catch((error) => {
  // Private browsing modes can block storage. Falling back to the default is
  // better than refusing to let anyone log in.
  console.error('Could not set session persistence:', error);
});

export { app, auth, authPersistenceReady, db, functions };
