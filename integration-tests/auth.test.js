// Integration tests for the auth functions, run against the emulators.
//
//   npm run test:auth
//
// Firebase Auth owns passwords now, so these exercise the real client path:
// call signup, then sign in with email and password, and check the role arrives
// as a custom claim rather than as a document field.

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import {
  connectAuthEmulator,
  getAuth,
  getIdTokenResult,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where
} from 'firebase/firestore';

const PROJECT_ID = 'retro-app-a95ca';
const AUTH_HOST = '127.0.0.1:9099';
const PASSWORD = 'known-password-123';

const ALICE_EMAIL = 'alice@intralinks.com';
const ADMIN_EMAIL = 'root@intralinks.com';

let testEnv;
let app;
let clientAuth;
let signup;
let setTempPassword;
let clientDb;

/** The Auth emulator accepts "Bearer owner" as an admin credential. */
async function authAdminPost(pathname, body) {
  const res = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/${pathname}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

const lookupByEmail = async (email) => {
  const body = await authAdminPost(`projects/${PROJECT_ID}/accounts:lookup`, { email: [email] });
  return (body.users ?? [])[0];
};

/** Waits for syncUserClaims to land, since trigger delivery is asynchronous. */
async function waitForClaim(email, predicate, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const record = await lookupByEmail(email);
    const claims = JSON.parse(record?.customAttributes ?? '{}');
    if (predicate(claims)) return claims;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`timed out waiting for claim: ${label}`);
}

async function clearAuthEmulator() {
  await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE'
  });
}

async function callAndCaptureError(fn, payload) {
  try {
    await fn(payload);
    assert.fail('expected the call to be rejected');
  } catch (err) {
    return { code: err.code, message: err.message };
  }
}

/** Finds the profile document for an email, whatever uid signup generated. */
async function profileByEmail(email) {
  let found;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDocs(
      query(collection(ctx.firestore(), 'users'), where('email', '==', email))
    );
    found = snap.docs[0];
  });
  return found;
}

const signInAs = (email, password = PASSWORD) =>
  signInWithEmailAndPassword(clientAuth, email, password);

before(async () => {
  testEnv = await initializeTestEnvironment({ projectId: PROJECT_ID });

  app = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake-api-key-for-emulator' });
  const functions = getFunctions(app);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  signup = httpsCallable(functions, 'signup');
  setTempPassword = httpsCallable(functions, 'setTempPassword');

  clientAuth = getAuth(app);
  connectAuthEmulator(clientAuth, `http://${AUTH_HOST}`, { disableWarnings: true });

  // A real client connection, so writes go through the deployed rules.
  clientDb = getFirestore(app);
  connectFirestoreEmulator(clientDb, '127.0.0.1', 8080);
});

after(async () => {
  await testEnv.cleanup();
  await deleteApp(app);
});

beforeEach(async () => {
  await signOut(clientAuth).catch(() => undefined);
  await testEnv.clearFirestore();
  await clearAuthEmulator();

  // Real accounts, created the way the app creates them.
  await signup({
    displayName: 'Alice',
    email: ALICE_EMAIL,
    password: PASSWORD,
    team: 'Tigers'
  });
  await signup({
    displayName: 'Root',
    email: ADMIN_EMAIL,
    password: PASSWORD,
    team: 'Protoss'
  });

  // Promote one to admin the way it really happens: flip isAdmin on the profile
  // and let syncUserClaims push it into the token. Setting the claim directly
  // would be overwritten, because the trigger treats the profile as the source
  // of truth.
  const admin = await lookupByEmail(ADMIN_EMAIL);
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users', admin.localId), { isAdmin: true });
  });
  await waitForClaim(ADMIN_EMAIL, (claims) => claims.isAdmin === true, 'admin isAdmin=true');
});

describe('signup', () => {
  const valid = {
    displayName: 'New Person',
    email: 'new.person@intralinks.com',
    password: 'a-brand-new-password',
    team: 'Tigers'
  };

  it('creates an account that can sign in with email and password', async () => {
    await signup(valid);

    const credential = await signInAs(valid.email, valid.password);
    const { claims } = await getIdTokenResult(credential.user);

    // Self-service signup must never mint an admin.
    assert.equal(claims.isAdmin, false);
    assert.equal(claims.team, 'Tigers');
    assert.equal(claims.firebase.sign_in_provider, 'password');
  });

  it('stores a profile and never a password hash', async () => {
    await signup(valid);
    const profile = await profileByEmail(valid.email);

    assert.equal(profile.data().isAdmin, false);
    assert.equal(profile.data().displayName, 'New Person');
    assert.equal(profile.data().passwordHash, undefined, 'no hash should exist in Firestore');
    assert.equal(profile.id, profile.data().id, 'document id and id field must agree');
  });

  // The old client check was `!endsWith(a) || !endsWith(b)`, always true, so
  // every ordinary signup failed and only the @admin.com path worked.
  it('accepts the allowed domain', async () => {
    const result = await signup({ ...valid, email: 'someone.else@intralinks.com' });
    assert.equal(result.data.ok, true);
  });

  it('rejects @admin.com, closing the old escalation path', async () => {
    const err = await callAndCaptureError(signup, { ...valid, email: 'sneaky@admin.com' });
    assert.equal(err.code, 'functions/permission-denied');
  });

  it('rejects any other domain', async () => {
    const err = await callAndCaptureError(signup, { ...valid, email: 'someone@gmail.com' });
    assert.equal(err.code, 'functions/permission-denied');
  });

  it('rejects a duplicate email', async () => {
    const err = await callAndCaptureError(signup, { ...valid, email: ALICE_EMAIL });
    assert.equal(err.code, 'functions/already-exists');
  });

  it('rejects a short password and a missing field', async () => {
    assert.equal(
      (await callAndCaptureError(signup, { ...valid, password: 'short' })).code,
      'functions/invalid-argument'
    );
    assert.equal(
      (await callAndCaptureError(signup, { ...valid, team: '' })).code,
      'functions/invalid-argument'
    );
  });

  it('ignores an isAdmin flag smuggled in the payload', async () => {
    await signup({ ...valid, email: 'climber@intralinks.com', isAdmin: true });
    const credential = await signInAs('climber@intralinks.com', valid.password);
    const { claims } = await getIdTokenResult(credential.user);
    assert.equal(claims.isAdmin, false);
  });
});

describe('signing in', () => {
  it('accepts the right password', async () => {
    const credential = await signInAs(ALICE_EMAIL);
    assert.ok(credential.user.uid);
  });

  it('rejects the wrong password', async () => {
    await assert.rejects(() => signInAs(ALICE_EMAIL, 'not-the-password'));
  });

  it('rejects an unknown account', async () => {
    await assert.rejects(() => signInAs('nobody@intralinks.com', PASSWORD));
  });
});

describe('setTempPassword', () => {
  it('refuses an anonymous caller', async () => {
    const alice = await profileByEmail(ALICE_EMAIL);
    const err = await callAndCaptureError(setTempPassword, {
      uid: alice.id,
      tempPassword: 'temporary-one'
    });
    assert.equal(err.code, 'functions/permission-denied');
  });

  it('refuses a signed-in non-admin', async () => {
    await signInAs(ALICE_EMAIL);
    const alice = await profileByEmail(ALICE_EMAIL);

    const err = await callAndCaptureError(setTempPassword, {
      uid: alice.id,
      tempPassword: 'temporary-one'
    });
    assert.equal(err.code, 'functions/permission-denied');
  });

  it('lets an admin rotate a password and flags the profile', async () => {
    await signInAs(ADMIN_EMAIL);
    const alice = await profileByEmail(ALICE_EMAIL);

    const result = await setTempPassword({ uid: alice.id, tempPassword: 'temporary-one' });
    assert.equal(result.data.ok, true);

    await signOut(clientAuth);

    // The temporary password works, the old one does not.
    const credential = await signInAs(ALICE_EMAIL, 'temporary-one');
    assert.equal(credential.user.uid, alice.id);
    await signOut(clientAuth);
    await assert.rejects(() => signInAs(ALICE_EMAIL, PASSWORD));

    const refreshed = await profileByEmail(ALICE_EMAIL);
    assert.equal(refreshed.data().hasTempPassword, true);
  });

  it('rejects a short temporary password and an unknown user', async () => {
    await signInAs(ADMIN_EMAIL);
    const alice = await profileByEmail(ALICE_EMAIL);

    assert.equal(
      (await callAndCaptureError(setTempPassword, { uid: alice.id, tempPassword: 'no' })).code,
      'functions/invalid-argument'
    );
    assert.equal(
      (await callAndCaptureError(setTempPassword, { uid: 'nope', tempPassword: 'temporary-one' }))
        .code,
      'functions/not-found'
    );
  });
});

describe('syncUserClaims trigger', () => {
  it('pushes an isAdmin change on the profile into the token claim', async () => {
    const alice = await profileByEmail(ALICE_EMAIL);

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', alice.id), { isAdmin: true });
    });

    const claims = await waitForClaim(
      ALICE_EMAIL,
      (c) => c.isAdmin === true,
      'alice isAdmin=true'
    );

    assert.equal(claims.isAdmin, true, 'claim should follow the profile');
  });
});

describe('generateSummary is admin-only', () => {
  const url = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/generateSummary`;

  const post = (idToken) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://www.sprintecho.com',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
      },
      body: JSON.stringify({ prompt: 'summarise this' })
    });

  it('rejects a request with no token', async () => {
    const res = await post(null);
    assert.equal(res.status, 401);
  });

  it('answers 401, not 500, for a malformed token', async () => {
    const res = await post('not-a-real-token');
    assert.equal(res.status, 401);
  });

  it('rejects a signed-in non-admin', async () => {
    const credential = await signInAs(ALICE_EMAIL);
    const res = await post(await credential.user.getIdToken());

    // The UI hides the button, but the endpoint is what actually has to refuse.
    assert.equal(res.status, 403);
  });

  it('lets an admin past the gate', async () => {
    const credential = await signInAs(ADMIN_EMAIL);
    const res = await post(await credential.user.getIdToken());

    // Deliberately not asserting 200: getting past the gate means it goes on to
    // call OpenAI, which has no usable key in the emulator. Anything other than
    // 401/403 proves the authorisation check passed.
    assert.ok(res.status !== 401 && res.status !== 403, `unexpected ${res.status}`);
  });
});

describe('temp-password flag', () => {
  it('can be cleared by its owner through the rules, no function needed', async () => {
    await signInAs(ADMIN_EMAIL);
    const alice = await profileByEmail(ALICE_EMAIL);
    await setTempPassword({ uid: alice.id, tempPassword: 'temporary-one' });
    await signOut(clientAuth);

    await signInAs(ALICE_EMAIL, 'temporary-one');

    // Exactly the write the auth page makes after updatePassword succeeds, and
    // it goes through the real rules as the signed-in user.
    await updateDoc(doc(clientDb, 'users', alice.id), { hasTempPassword: false });

    const refreshed = await profileByEmail(ALICE_EMAIL);
    assert.equal(refreshed.data().hasTempPassword, false);
  });
});
