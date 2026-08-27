// Integration tests for the syncSprintCounts trigger, run against the emulators.
//
//   npm run test:auth
//
// The landing page renders its per-category counters straight from
// sprints/{id}.counts, so if this trigger is wrong the numbers on every card are
// wrong with no other symptom.

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'retro-app-a95ca';
const AUTH_HOST = '127.0.0.1:9099';
const SPRINT = 'counts-sprint';
const PASSWORD = 'known-password-123';
const ADMIN_UID = 'counts-admin';
const ADMIN_EMAIL = 'counts.admin@example.com';
const PLAIN_UID = 'counts-plain';
const PLAIN_EMAIL = 'counts.plain@example.com';

let testEnv;
let app;
let clientAuth;
let backfillSprintCounts;

/** Runs as the admin SDK would: rules off, so the fixtures are unconstrained. */
const asAdmin = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

const note = (category, published, createdBy = 'someone') => ({
  text: `a ${category} note`,
  category,
  createdBy,
  createdAt: new Date(),
  published,
  likes: 0,
  dislikes: 0,
  votes: {},
  order: 0
});

/** Trigger delivery is asynchronous, so poll until the counts settle. */
async function waitForCounts(expected, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    let counts;
    await asAdmin(async (db) => {
      counts = (await getDoc(doc(db, 'sprints', SPRINT))).data()?.counts;
    });
    if (counts && JSON.stringify(counts) === JSON.stringify(expected)) return counts;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`timed out waiting for counts: ${label}`);
}

/** The Auth emulator accepts "Bearer owner" as an admin credential. */
async function createAccount(uid, email, isAdmin) {
  await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid, email, password: PASSWORD })
    }
  );

  await asAdmin(async (db) => {
    await setDoc(doc(db, 'users', uid), {
      id: uid,
      email,
      displayName: email,
      team: 'Protoss',
      canParty: false,
      isAdmin,
      hasTempPassword: false
    });
  });

  // syncUserClaims pushes isAdmin into the token, and it is the claim the
  // callable checks, so wait for it rather than the document.
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const res = await fetch(
      `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:lookup`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: [email] })
      }
    );
    const body = await res.json();
    const claims = JSON.parse((body.users ?? [])[0]?.customAttributes ?? '{}');
    if (claims.isAdmin === isAdmin) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`timed out waiting for isAdmin=${isAdmin} claim on ${email}`);
}

before(async () => {
  testEnv = await initializeTestEnvironment({ projectId: PROJECT_ID });

  app = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake-api-key-for-emulator' });
  const functions = getFunctions(app);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  backfillSprintCounts = httpsCallable(functions, 'backfillSprintCounts');

  clientAuth = getAuth(app);
  connectAuthEmulator(clientAuth, `http://${AUTH_HOST}`, { disableWarnings: true });
});

after(async () => {
  await testEnv.cleanup();
  await deleteApp(app);
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await asAdmin(async (db) => {
    await setDoc(doc(db, 'sprints', SPRINT), {
      title: 'Counting',
      team: 'Protoss',
      isOpen: true,
      createdAt: new Date(),
      celebrating: false,
      summary: '',
      counts: { good: 0, bad: 0, action: 0 }
    });
  });
});

describe('syncSprintCounts', () => {
  it('counts published notes per category', async () => {
    await asAdmin(async (db) => {
      const items = collection(db, 'sprints', SPRINT, 'items');
      await addDoc(items, note('good', true));
      await addDoc(items, note('good', true));
      await addDoc(items, note('bad', true));
      await addDoc(items, note('action', true));
    });

    await waitForCounts({ good: 2, bad: 1, action: 1 }, 'two good, one bad, one action');
  });

  // The counters on the cards deliberately show only shared notes, so a private
  // draft must not appear until it is published.
  it('ignores unpublished drafts, then counts them on publish', async () => {
    let draftId;
    await asAdmin(async (db) => {
      const items = collection(db, 'sprints', SPRINT, 'items');
      await addDoc(items, note('good', true));
      draftId = (await addDoc(items, note('good', false))).id;
    });

    await waitForCounts({ good: 1, bad: 0, action: 0 }, 'draft not counted');

    await asAdmin(async (db) => {
      await updateDoc(doc(db, 'sprints', SPRINT, 'items', draftId), { published: true });
    });

    await waitForCounts({ good: 2, bad: 0, action: 0 }, 'draft counted once published');
  });

  it('drops the count again when a note is deleted', async () => {
    let noteId;
    await asAdmin(async (db) => {
      const items = collection(db, 'sprints', SPRINT, 'items');
      noteId = (await addDoc(items, note('bad', true))).id;
    });

    await waitForCounts({ good: 0, bad: 1, action: 0 }, 'one bad note');

    await asAdmin(async (db) => {
      await deleteDoc(doc(db, 'sprints', SPRINT, 'items', noteId));
    });

    await waitForCounts({ good: 0, bad: 0, action: 0 }, 'back to zero after delete');
  });

  it('settles on the right total after a batch of writes', async () => {
    await asAdmin(async (db) => {
      const items = collection(db, 'sprints', SPRINT, 'items');
      await Promise.all([
        addDoc(items, note('good', true)),
        addDoc(items, note('good', true)),
        addDoc(items, note('good', true)),
        addDoc(items, note('bad', true)),
        addDoc(items, note('bad', true)),
        addDoc(items, note('action', true))
      ]);
    });

    // Recomputing from a query rather than incrementing is what makes
    // concurrent deliveries converge instead of drifting.
    await waitForCounts({ good: 3, bad: 2, action: 1 }, 'six concurrent notes');
  });
});

describe('backfillSprintCounts', () => {
  beforeEach(async () => {
    await signOut(clientAuth).catch(() => undefined);
    await createAccount(ADMIN_UID, ADMIN_EMAIL, true);
    await createAccount(PLAIN_UID, PLAIN_EMAIL, false);
  });

  it('refuses an anonymous caller and a signed-in non-admin', async () => {
    await assert.rejects(() => backfillSprintCounts({}), /permission-denied|Admins only/);

    await signInWithEmailAndPassword(clientAuth, PLAIN_EMAIL, PASSWORD);
    await assert.rejects(() => backfillSprintCounts({}), /permission-denied|Admins only/);
  });

  it('repairs counts that are wrong or missing entirely', async () => {
    await asAdmin(async (db) => {
      const items = collection(db, 'sprints', SPRINT, 'items');
      await addDoc(items, note('good', true));
      await addDoc(items, note('action', true));
    });
    await waitForCounts({ good: 1, bad: 0, action: 1 }, 'trigger set the baseline');

    // A sprint from before the trigger existed has no counts at all; another has
    // drifted. Written with rules off, the way console meddling would.
    await asAdmin(async (db) => {
      await updateDoc(doc(db, 'sprints', SPRINT), { counts: { good: 99, bad: 99, action: 99 } });
      await setDoc(doc(db, 'sprints', 'legacy-sprint'), {
        title: 'Before the trigger',
        team: 'Protoss',
        isOpen: false,
        createdAt: new Date(),
        celebrating: false,
        summary: ''
      });
    });

    await signInWithEmailAndPassword(clientAuth, ADMIN_EMAIL, PASSWORD);
    const { data } = await backfillSprintCounts({});

    assert.equal(data.ok, true);
    assert.equal(data.total, 2);
    assert.equal(data.updated, 2, 'both the drifted and the missing one');

    await asAdmin(async (db) => {
      const fixed = (await getDoc(doc(db, 'sprints', SPRINT))).data().counts;
      assert.deepEqual(fixed, { good: 1, bad: 0, action: 1 });
      const legacy = (await getDoc(doc(db, 'sprints', 'legacy-sprint'))).data().counts;
      assert.deepEqual(legacy, { good: 0, bad: 0, action: 0 });
    });
  });

  it('is idempotent', async () => {
    await signInWithEmailAndPassword(clientAuth, ADMIN_EMAIL, PASSWORD);
    await backfillSprintCounts({});
    const { data } = await backfillSprintCounts({});
    assert.equal(data.updated, 0, 'nothing left to change');
  });
});
