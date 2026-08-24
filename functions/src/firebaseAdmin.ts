import * as admin from "firebase-admin";

// Initialised here rather than inside index.ts so that every module gets a
// ready app no matter the import order: ES imports are evaluated before the
// importing module's own statements run.
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const authAdmin = admin.auth();
export { admin };
