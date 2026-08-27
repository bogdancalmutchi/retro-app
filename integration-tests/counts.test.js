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
import { addDoc, collection, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'retro-app-a95ca';
const SPRINT = 'counts-sprint';

let testEnv;

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

before(async () => {
  testEnv = await initializeTestEnvironment({ projectId: PROJECT_ID });
});

after(async () => {
  await testEnv.cleanup();
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
