import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
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

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

if (recaptchaSiteKey && !useEmulators) {
  if (import.meta.env.DEV) {
    // Prefer an explicit token from .env.local over `true`. With `true` the SDK
    // invents a token and keeps it in browser storage, so clearing storage or
    // switching browser gives a fresh one that was never registered under
    // App Check > Manage debug tokens, and attestation fails with a 403.
    (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
      import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true
  });
}

const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app);

if (useEmulators) {
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
