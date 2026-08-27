// Tests for the one-off migration script, run against the emulators.
//
//   npm run test:migrate
//
// Seeds data shaped like production today (a bcrypt hash on the profile, a
// mixed-case email, an Auth account holding an address under the wrong uid, and
// leftover anonymous accounts), runs the script for real, and checks the end
// state - including that the temporary passwords it prints actually work.

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { after, before, beforeEach, describe, it } from 'node:test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const execFileAsync = promisify(execFile);

const PROJECT_ID = 'retro-app-a95ca';
const AUTH_HOST = '127.0.0.1:9099';

// No Auth account yet, hash on the profile, email stored with odd casing.
const PLAIN = '11111111-1111-1111-1111-111111111111';
// Its email is held by an Auth account under a different uid.
const MISMATCHED = '22222222-2222-2222-2222-222222222222';
const WRONG_UID = 'auto-generated-uid-from-createUserWithEmailAndPassword';

let testEnv;

const runMigration = (args = []) =>
  execFileAsync('node', ['functions/scripts/migrate.js', ...args], {
    env: {
      ...process.env,
      GCLOUD_PROJECT: PROJECT_ID,
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080',
      FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST || AUTH_HOST
    }
  });

const authPost = async (pathname, body, admin = true) => {
  const res = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/${pathname}`, {
    method: 'POST',
    headers: {
      ...(admin ? { Authorization: 'Bearer owner' } : {}),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  return res.json();
};

const listAccounts = async () =>
  (await authPost(`projects/${PROJECT_ID}/accounts:query`, {})).userInfo ?? [];

const createAccount = (uid, email) =>
  authPost(`projects/${PROJECT_ID}/accounts:batchCreate`, {
    users: [{ localId: uid, email }]
  });

/** Anonymous sign-up: no email, no password, no provider. */
const createAnonymousAccount = () =>
  authPost('accounts:signUp?key=fake-key', { returnSecureToken: true }, false);

const signInWithPassword = (email, password) =>
  authPost('accounts:signInWithPassword?key=fake-key', {
    email,
    password,
    returnSecureToken: true
  }, false);

async function clearAuthEmulator() {
  await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE'
  });
}

/** Pulls the "email   password" table off the end of an apply run. */
function parseIssuedPasswords(stdout) {
  const marker = stdout.indexOf('Temporary passwords');
  const table = marker === -1 ? '' : stdout.slice(marker);
  const issued = new Map();
  for (const line of table.split('\n')) {
    const match = line.match(/^\s+(\S+@\S+)\s+(\S+)\s*$/);
    if (match) issued.set(match[1], match[2]);
  }
  return issued;
}

before(async () => {
  testEnv = await initializeTestEnvironment({ projectId: PROJECT_ID });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await clearAuthEmulator();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await setDoc(doc(db, 'users', PLAIN), {
      id: PLAIN,
      displayName: 'Plain Person',
      email: 'Plain.Person@Example.com',
      team: 'Tigers',
      canParty: false,
      isAdmin: false,
      hasTempPassword: false,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN'
    });

    await setDoc(doc(db, 'users', MISMATCHED), {
      id: MISMATCHED,
      displayName: 'Admin Person',
      email: 'admin.person@admin.com',
      team: 'Protoss',
      canParty: true,
      isAdmin: true,
      hasTempPassword: false,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN'
    });
  });

  // The pre-existing Auth account, under the wrong uid.
  await createAccount(WRONG_UID, 'admin.person@admin.com');
  // Leftovers of the kind found in production.
  await createAnonymousAccount();
  await createAnonymousAccount();
  await createAnonymousAccount();
});

describe('migrate.js', () => {
  it('writes nothing on a dry run', async () => {
    const { stdout } = await runMigration();
    assert.match(stdout, /DRY RUN/);
    assert.doesNotMatch(stdout, /Temporary passwords\n/);

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const profile = await getDoc(doc(ctx.firestore(), 'users', PLAIN));
      assert.notEqual(profile.data().passwordHash, undefined, 'hash should be untouched');
      assert.equal(profile.data().email, 'Plain.Person@Example.com');
    });

    const accounts = await listAccounts();
    // Nothing created, nothing deleted: 1 mismatched + 3 anonymous.
    assert.equal(accounts.length, 4);
  });

  it('lists the destructive deletions in the dry run', async () => {
    const { stdout } = await runMigration();
    assert.match(stdout, /DELETE Auth account .* under the wrong uid/);
    assert.match(stdout, /DELETE 3 leftover anonymous Auth account\(s\)/);
  });

  it('deletes the leaked password hashes and lowercases emails', async () => {
    await runMigration(['--apply']);

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (const uid of [PLAIN, MISMATCHED]) {
        const profile = await getDoc(doc(db, 'users', uid));
        assert.equal(profile.data().passwordHash, undefined, `${uid} hash should be gone`);
      }
      const plain = await getDoc(doc(db, 'users', PLAIN));
      assert.equal(plain.data().email, 'plain.person@example.com');
    });
  });

  it('creates Auth accounts pinned to the Firestore document id', async () => {
    await runMigration(['--apply']);

    const byUid = new Map((await listAccounts()).map((a) => [a.localId, a]));
    assert.ok(byUid.has(PLAIN), 'plain user should have an account');
    assert.equal(byUid.get(PLAIN).email, 'plain.person@example.com');
    assert.ok(byUid.has(MISMATCHED), 'mismatched user should have a pinned account');
    assert.equal(byUid.get(MISMATCHED).email, 'admin.person@admin.com');
  });

  it('removes the mismatched account and the anonymous leftovers', async () => {
    await runMigration(['--apply']);

    const uids = (await listAccounts()).map((a) => a.localId);
    assert.ok(!uids.includes(WRONG_UID), 'wrong-uid account should be deleted');
    // Exactly the two real users remain.
    assert.equal(uids.length, 2);
    assert.deepEqual([...uids].sort(), [PLAIN, MISMATCHED].sort());
  });

  it('sets isAdmin and team claims and flags hasTempPassword', async () => {
    await runMigration(['--apply']);

    const accounts = await listAccounts();
    const claimsFor = (uid) =>
      JSON.parse(accounts.find((a) => a.localId === uid).customAttributes ?? '{}');

    assert.deepEqual(claimsFor(MISMATCHED), { isAdmin: true, team: 'Protoss' });
    assert.deepEqual(claimsFor(PLAIN), { isAdmin: false, team: 'Tigers' });

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const profile = await getDoc(doc(ctx.firestore(), 'users', PLAIN));
      assert.equal(profile.data().hasTempPassword, true);
    });
  });

  it('prints temporary passwords that actually work', async () => {
    const { stdout } = await runMigration(['--apply']);
    const issued = parseIssuedPasswords(stdout);

    assert.equal(issued.size, 2, 'one password per user');

    for (const [email, password] of issued) {
      const result = await signInWithPassword(email, password);
      assert.ok(result.idToken, `${email} should sign in with its temporary password`);
    }

    // A wrong password still fails, so the check above is meaningful.
    const bad = await signInWithPassword([...issued.keys()][0], 'definitely-not-it');
    assert.equal(bad.idToken, undefined);
  });
});
