// Integration tests for the auth functions, run against the emulators.
//
//   npm run test:auth
//
// Firebase Auth owns passwords now, so these exercise the real client path:
// redeem an invite, then sign in with email and password, and check the role
// arrives as a custom claim rather than as a document field.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

const PROJECT_ID = 'retro-app-a95ca';
const AUTH_HOST = '127.0.0.1:9099';
const PASSWORD = 'known-password-123';

const ALICE_EMAIL = 'alice@example.com';
const ADMIN_EMAIL = 'root@example.com';

const ALICE_UID = 'alice-uid';
const ADMIN_UID = 'admin-uid';

let testEnv;
let app;
let clientAuth;
let createInvite;
let checkInvite;
let redeemInvite;
let revokeInvite;
let listInvites;
let setTempPassword;
let clientDb;

const tokenHashOf = (token) => createHash('sha256').update(token).digest('hex');

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

/** Finds the profile document for an email, whatever uid was generated. */
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
  createInvite = httpsCallable(functions, 'createInvite');
  checkInvite = httpsCallable(functions, 'checkInvite');
  redeemInvite = httpsCallable(functions, 'redeemInvite');
  revokeInvite = httpsCallable(functions, 'revokeInvite');
  listInvites = httpsCallable(functions, 'listInvites');
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

/**
 * There is no self-service signup any more, and the first admin cannot be
 * invited by anybody, so the fixtures are provisioned the way a bootstrap
 * really has to be: straight into Auth and Firestore, letting syncUserClaims
 * push the profile into the token exactly as it does in production.
 */
async function createAccount({ uid, email, displayName, team, isAdmin = false }) {
  await authAdminPost(`projects/${PROJECT_ID}/accounts`, {
    localId: uid,
    email,
    password: PASSWORD,
    displayName
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), {
      id: uid,
      email,
      displayName,
      team,
      canParty: false,
      isAdmin,
      hasTempPassword: false
    });
  });

  await waitForClaim(
    email,
    (claims) => claims.team === team && claims.isAdmin === isAdmin,
    `${email} claims`
  );
}

/** Signs in as the admin and mints an invite, returning its token and hash. */
async function inviteAs(email, team) {
  await signInAs(ADMIN_EMAIL);
  const result = await createInvite({ email, team });
  return { token: result.data.token, tokenHash: tokenHashOf(result.data.token) };
}

beforeEach(async () => {
  await signOut(clientAuth).catch(() => undefined);
  await testEnv.clearFirestore();
  await clearAuthEmulator();

  await createAccount({
    uid: ALICE_UID,
    email: ALICE_EMAIL,
    displayName: 'Alice',
    team: 'Tigers'
  });
  await createAccount({
    uid: ADMIN_UID,
    email: ADMIN_EMAIL,
    displayName: 'Root',
    team: 'Protoss',
    isAdmin: true
  });
});

const NEW_EMAIL = 'new.person@example.com';
const NEW_PASSWORD = 'a-brand-new-password';

describe('createInvite', () => {
  it('refuses an anonymous caller', async () => {
    const err = await callAndCaptureError(createInvite, { email: NEW_EMAIL, team: 'Tigers' });
    assert.equal(err.code, 'functions/permission-denied');
  });

  it('refuses a signed-in non-admin', async () => {
    await signInAs(ALICE_EMAIL);
    const err = await callAndCaptureError(createInvite, { email: NEW_EMAIL, team: 'Tigers' });
    assert.equal(err.code, 'functions/permission-denied');
  });

  it('returns a token once and stores only its hash', async () => {
    await signInAs(ADMIN_EMAIL);
    const result = await createInvite({ email: NEW_EMAIL, team: 'Tigers' });

    assert.equal(result.data.ok, true);
    assert.ok(result.data.token.length >= 32, 'token should be long');
    assert.equal(result.data.email, NEW_EMAIL);
    assert.equal(result.data.team, 'Tigers');

    // The document id is the hash, and the plaintext appears nowhere.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDocs(collection(ctx.firestore(), 'invites'));
      assert.equal(snap.size, 1);
      assert.equal(snap.docs[0].id, tokenHashOf(result.data.token));
      assert.equal(JSON.stringify(snap.docs[0].data()).includes(result.data.token), false);
    });
  });

  it('rejects a malformed address and a missing team', async () => {
    await signInAs(ADMIN_EMAIL);
    assert.equal(
      (await callAndCaptureError(createInvite, { email: 'nope', team: 'Tigers' })).code,
      'functions/invalid-argument'
    );
    assert.equal(
      (await callAndCaptureError(createInvite, { email: NEW_EMAIL, team: '' })).code,
      'functions/invalid-argument'
    );
  });

  // The token is the gate now, so an admin may invite any well-formed address.
  it('allows an address outside the old hardcoded domain', async () => {
    await signInAs(ADMIN_EMAIL);
    const result = await createInvite({ email: 'contractor@example.com', team: 'Tigers' });
    assert.equal(result.data.ok, true);
  });

  it('refuses to invite an address that already has an account', async () => {
    await signInAs(ADMIN_EMAIL);
    const err = await callAndCaptureError(createInvite, { email: ALICE_EMAIL, team: 'Tigers' });
    assert.equal(err.code, 'functions/already-exists');
  });
});

describe('checkInvite', () => {
  it('tells the invite page who the link is for', async () => {
    const { token } = await inviteAs(NEW_EMAIL, 'Tigers');
    await signOut(clientAuth);

    const result = await checkInvite({ token });
    assert.equal(result.data.email, NEW_EMAIL);
    assert.equal(result.data.team, 'Tigers');
  });

  it('rejects an unknown token without saying why', async () => {
    const err = await callAndCaptureError(checkInvite, { token: 'not-a-real-token' });
    assert.equal(err.code, 'functions/not-found');
    assert.match(err.message, /not valid or has expired/);
  });
});

describe('redeemInvite', () => {
  it('creates an account that can sign in, with the team from the invite', async () => {
    const { token } = await inviteAs(NEW_EMAIL, 'Tigers');
    await signOut(clientAuth);

    const result = await redeemInvite({
      token,
      displayName: 'New Person',
      password: NEW_PASSWORD
    });
    assert.equal(result.data.ok, true);

    const credential = await signInAs(NEW_EMAIL, NEW_PASSWORD);
    const { claims } = await getIdTokenResult(credential.user);

    assert.equal(claims.isAdmin, false, 'redeeming must never mint an admin');
    assert.equal(claims.team, 'Tigers');
    assert.equal(claims.firebase.sign_in_provider, 'password');

    const profile = await profileByEmail(NEW_EMAIL);
    assert.equal(profile.data().displayName, 'New Person');
    assert.equal(profile.data().passwordHash, undefined, 'no hash should exist in Firestore');
    assert.equal(profile.id, profile.data().id, 'document id and id field must agree');
  });

  it('takes the email and team from the invite, not the payload', async () => {
    const { token } = await inviteAs(NEW_EMAIL, 'Tigers');
    await signOut(clientAuth);

    await redeemInvite({
      token,
      displayName: 'New Person',
      password: NEW_PASSWORD,
      email: 'attacker@example.com',
      team: 'Protoss',
      isAdmin: true
    });

    // The smuggled address never became an account.
    assert.equal(await lookupByEmail('attacker@example.com'), undefined);

    const credential = await signInAs(NEW_EMAIL, NEW_PASSWORD);
    const { claims } = await getIdTokenResult(credential.user);
    assert.equal(claims.team, 'Tigers');
    assert.equal(claims.isAdmin, false);
  });

  it('cannot be used twice', async () => {
    const { token } = await inviteAs(NEW_EMAIL, 'Tigers');
    await signOut(clientAuth);

    await redeemInvite({ token, displayName: 'New Person', password: NEW_PASSWORD });

    const err = await callAndCaptureError(redeemInvite, {
      token,
      displayName: 'Second Person',
      password: NEW_PASSWORD
    });
    assert.equal(err.code, 'functions/not-found');
  });

  it('rejects a revoked invite', async () => {
    const { token, tokenHash } = await inviteAs(NEW_EMAIL, 'Tigers');
    await revokeInvite({ tokenHash });
    await signOut(clientAuth);

    const err = await callAndCaptureError(redeemInvite, {
      token,
      displayName: 'New Person',
      password: NEW_PASSWORD
    });
    assert.equal(err.code, 'functions/not-found');
  });

  it('rejects an expired invite', async () => {
    const { token, tokenHash } = await inviteAs(NEW_EMAIL, 'Tigers');
    await signOut(clientAuth);

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'invites', tokenHash), {
        expiresAt: new Date(Date.now() - 1000)
      });
    });

    const err = await callAndCaptureError(redeemInvite, {
      token,
      displayName: 'New Person',
      password: NEW_PASSWORD
    });
    assert.equal(err.code, 'functions/not-found');
  });

  it('rejects a short password and a missing name, leaving the invite usable', async () => {
    const { token } = await inviteAs(NEW_EMAIL, 'Tigers');
    await signOut(clientAuth);

    assert.equal(
      (await callAndCaptureError(redeemInvite, {
        token,
        displayName: 'New Person',
        password: 'short'
      })).code,
      'functions/invalid-argument'
    );
    assert.equal(
      (await callAndCaptureError(redeemInvite, {
        token,
        displayName: '',
        password: NEW_PASSWORD
      })).code,
      'functions/invalid-argument'
    );

    // Rejected for its input, so the link still works.
    const result = await redeemInvite({
      token,
      displayName: 'New Person',
      password: NEW_PASSWORD
    });
    assert.equal(result.data.ok, true);
  });
});

describe('listInvites and revokeInvite are admin-only', () => {
  it('refuse an anonymous caller and a non-admin', async () => {
    assert.equal((await callAndCaptureError(listInvites, {})).code, 'functions/permission-denied');
    assert.equal(
      (await callAndCaptureError(revokeInvite, { tokenHash: 'x' })).code,
      'functions/permission-denied'
    );

    await signInAs(ALICE_EMAIL);
    assert.equal((await callAndCaptureError(listInvites, {})).code, 'functions/permission-denied');
    assert.equal(
      (await callAndCaptureError(revokeInvite, { tokenHash: 'x' })).code,
      'functions/permission-denied'
    );
  });

  it('let an admin see an outstanding invite without exposing the token', async () => {
    const { token, tokenHash } = await inviteAs(NEW_EMAIL, 'Tigers');

    const result = await listInvites({});
    assert.equal(result.data.invites.length, 1);

    const [invite] = result.data.invites;
    assert.equal(invite.tokenHash, tokenHash);
    assert.equal(invite.email, NEW_EMAIL);
    assert.equal(invite.usedAt, null);
    assert.equal(invite.revokedAt, null);
    assert.equal(JSON.stringify(result.data).includes(token), false);
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
    await assert.rejects(() => signInAs('nobody@example.com', PASSWORD));
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

    // Sent with no prompt on purpose. The function validates the caller first
    // and only then the body, so a 400 proves the admin cleared the gate while
    // stopping short of the OpenAI call - these tests must not spend real money
    // or depend on the account's credit balance. The emulator resolves the live
    // secret from Secret Manager, so a request with a prompt would genuinely
    // bill the account.
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await credential.user.getIdToken()}`
      },
      body: JSON.stringify({})
    });

    assert.equal(res.status, 400);
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
