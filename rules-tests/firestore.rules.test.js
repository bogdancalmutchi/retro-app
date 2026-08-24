// Firestore rules tests for SprintEcho.
//
// Run with:  npm run test:rules
// (that wraps this in `firebase emulators:exec --only firestore`, which sets
//  FIRESTORE_EMULATOR_HOST for us)
//
// Several of these cases are the exact attacks that work against production
// today: anonymous reads of the users collection, and clients writing their
// own isAdmin flag.

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc
} from 'firebase/firestore';

const ALICE = 'alice-uuid';
const BOB = 'bob-uuid';
const SPRINT = 'sprint-1';
const NOTE = 'note-1';

let testEnv;

// Signed out, ordinary user, and admin-with-claim.
const anon = () => testEnv.unauthenticatedContext().firestore();
const alice = () => testEnv.authenticatedContext(ALICE).firestore();
const bob = () => testEnv.authenticatedContext(BOB).firestore();
const admin = () => testEnv.authenticatedContext('admin-uuid', { isAdmin: true }).firestore();

// A session from Firebase's anonymous provider. Anonymous sign-in is enabled on
// this project, so this is something an outsider can actually obtain with only
// the public web API key.
const anonymousProvider = () =>
  testEnv
    .authenticatedContext('drive-by-uuid', {
      firebase: { sign_in_provider: 'anonymous', identities: {} }
    })
    .firestore();

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'retro-app-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ALICE), {
      id: ALICE,
      displayName: 'Alice',
      email: 'alice@intralinks.com',
      team: 'core',
      canParty: false,
      isAdmin: false,
      hasTempPassword: false
    });
    await setDoc(doc(db, 'users', BOB), {
      id: BOB,
      displayName: 'Bob',
      email: 'bob@intralinks.com',
      team: 'core',
      canParty: false,
      isAdmin: false,
      hasTempPassword: false
    });
    await setDoc(doc(db, 'sprints', SPRINT), {
      name: 'Sprint 1',
      isOpen: true,
      presenterId: null,
      highlightedCardId: null,
      celebrating: false
    });
    await setDoc(doc(db, 'sprints', SPRINT, 'items', NOTE), {
      text: 'we shipped it',
      category: 'good',
      likes: 0,
      dislikes: 0,
      createdBy: ALICE,
      published: true,
      order: 0
    });
  });
});

describe('anonymous sessions are not enough', () => {
  it('denies an anonymous-provider session everywhere', async () => {
    await assertFails(getDoc(doc(anonymousProvider(), 'users', ALICE)));
    await assertFails(getDoc(doc(anonymousProvider(), 'sprints', SPRINT)));
    await assertFails(getDocs(collection(anonymousProvider(), 'sprints', SPRINT, 'items')));
  });

  it('denies an anonymous-provider session writing anything', async () => {
    await assertFails(
      updateDoc(doc(anonymousProvider(), 'sprints', SPRINT), { celebrating: true })
    );
    await assertFails(
      setDoc(doc(anonymousProvider(), 'sprints', SPRINT, 'items', 'x'), {
        text: 'drive by',
        category: 'good',
        likes: 0,
        dislikes: 0,
        createdBy: 'drive-by-uuid',
        published: true,
        order: 0
      })
    );
  });
});

describe('users/ reads', () => {
  // This is the live exposure: today this call returns HTTP 200 with every
  // password hash in the collection.
  it('denies anonymous access entirely', async () => {
    await assertFails(getDoc(doc(anon(), 'users', ALICE)));
    await assertFails(getDocs(collection(anon(), 'users')));
  });

  it('lets a signed-in user read a single profile', async () => {
    // Needed for presenter names, note authors and avatar seeds.
    await assertSucceeds(getDoc(doc(bob(), 'users', ALICE)));
  });

  it('denies a non-admin enumerating the whole collection', async () => {
    await assertFails(getDocs(collection(alice(), 'users')));
  });

  it('allows an admin to enumerate for the admin page', async () => {
    await assertSucceeds(getDocs(collection(admin(), 'users')));
  });
});

describe('users/ writes', () => {
  it('lets a user rename themselves', async () => {
    await assertSucceeds(updateDoc(doc(alice(), 'users', ALICE), { displayName: 'Alice A.' }));
  });

  it('lets a user unlock the confetti easter egg', async () => {
    await assertSucceeds(updateDoc(doc(alice(), 'users', ALICE), { canParty: true }));
  });

  // Privilege escalation, currently possible from the browser console.
  it('denies self-granting admin', async () => {
    await assertFails(updateDoc(doc(alice(), 'users', ALICE), { isAdmin: true }));
  });

  it('denies writing a password hash back onto a profile', async () => {
    // Nothing should ever put a hash in Firestore again.
    await assertFails(updateDoc(doc(alice(), 'users', ALICE), { passwordHash: 'x' }));
  });

  it('lets a user clear their own temporary-password flag but not set it', async () => {
    await assertSucceeds(updateDoc(doc(alice(), 'users', ALICE), { hasTempPassword: false }));
    await assertFails(updateDoc(doc(alice(), 'users', ALICE), { hasTempPassword: true }));
  });

  it('denies clearing someone else\u2019s temporary-password flag', async () => {
    await assertFails(updateDoc(doc(bob(), 'users', ALICE), { hasTempPassword: false }));
  });

  it('denies editing someone else’s profile', async () => {
    await assertFails(updateDoc(doc(bob(), 'users', ALICE), { displayName: 'pwned' }));
  });

  it('denies changing your own email or team', async () => {
    await assertFails(updateDoc(doc(alice(), 'users', ALICE), { email: 'alice@admin.com' }));
    await assertFails(updateDoc(doc(alice(), 'users', ALICE), { team: 'other' }));
  });

  it('denies creating or deleting profiles from the client', async () => {
    await assertFails(setDoc(doc(alice(), 'users', 'brand-new'), { displayName: 'X' }));
    await assertFails(deleteDoc(doc(alice(), 'users', ALICE)));
  });

  it('rejects a blank or oversized display name', async () => {
    await assertFails(updateDoc(doc(alice(), 'users', ALICE), { displayName: '' }));
    await assertFails(updateDoc(doc(alice(), 'users', ALICE), { displayName: 'x'.repeat(41) }));
  });

  // The current app writes the team string into canParty; rules now catch it.
  it('rejects a non-boolean canParty', async () => {
    await assertFails(updateDoc(doc(alice(), 'users', ALICE), { canParty: 'core' }));
  });
});

describe('sprints/', () => {
  it('denies anonymous access', async () => {
    await assertFails(getDoc(doc(anon(), 'sprints', SPRINT)));
    await assertFails(updateDoc(doc(anon(), 'sprints', SPRINT), { isOpen: false }));
  });

  it('allows signed-in reads and collaborative updates', async () => {
    await assertSucceeds(getDoc(doc(alice(), 'sprints', SPRINT)));
    await assertSucceeds(updateDoc(doc(alice(), 'sprints', SPRINT), { presenterId: ALICE }));
    await assertSucceeds(updateDoc(doc(alice(), 'sprints', SPRINT), { celebrating: true }));
    await assertSucceeds(updateDoc(doc(alice(), 'sprints', SPRINT), { summary: 'a summary' }));
  });

  it('denies writing fields outside the allowlist', async () => {
    await assertFails(updateDoc(doc(alice(), 'sprints', SPRINT), { injected: 'nope' }));
  });

  it('restricts deletion to admins', async () => {
    await assertFails(deleteDoc(doc(alice(), 'sprints', SPRINT)));
    await assertSucceeds(deleteDoc(doc(admin(), 'sprints', SPRINT)));
  });
});

describe('sprints/{id}/items/', () => {
  const newNote = (createdBy) => ({
    text: 'a new note',
    category: 'good',
    likes: 0,
    dislikes: 0,
    createdBy,
    published: false,
    order: 1
  });

  it('denies anonymous access', async () => {
    await assertFails(getDocs(collection(anon(), 'sprints', SPRINT, 'items')));
    await assertFails(setDoc(doc(anon(), 'sprints', SPRINT, 'items', 'x'), newNote(ALICE)));
  });

  it('allows a signed-in user to create a note attributed to themselves', async () => {
    await assertSucceeds(
      setDoc(doc(alice(), 'sprints', SPRINT, 'items', 'new-1'), newNote(ALICE))
    );
  });

  it('denies forging authorship', async () => {
    await assertFails(
      setDoc(doc(bob(), 'sprints', SPRINT, 'items', 'new-2'), newNote(ALICE))
    );
  });

  it('rejects an unknown category or empty text', async () => {
    await assertFails(
      setDoc(doc(alice(), 'sprints', SPRINT, 'items', 'new-3'), {
        ...newNote(ALICE),
        category: 'ugly'
      })
    );
    await assertFails(
      setDoc(doc(alice(), 'sprints', SPRINT, 'items', 'new-4'), { ...newNote(ALICE), text: '' })
    );
  });

  it('lets anyone vote and reorder', async () => {
    await assertSucceeds(updateDoc(doc(bob(), 'sprints', SPRINT, 'items', NOTE), { likes: 1 }));
    await assertSucceeds(updateDoc(doc(bob(), 'sprints', SPRINT, 'items', NOTE), { order: 5 }));
  });

  it('lets only the author edit note text', async () => {
    await assertSucceeds(
      updateDoc(doc(alice(), 'sprints', SPRINT, 'items', NOTE), { text: 'edited' })
    );
    await assertFails(
      updateDoc(doc(bob(), 'sprints', SPRINT, 'items', NOTE), { text: 'tampered' })
    );
  });

  it('lets the author or an admin delete, but not a bystander', async () => {
    await assertFails(deleteDoc(doc(bob(), 'sprints', SPRINT, 'items', NOTE)));
    await assertSucceeds(deleteDoc(doc(alice(), 'sprints', SPRINT, 'items', NOTE)));
  });
});

describe('unmatched paths are denied', () => {
  it('denies a collection the rules do not mention', async () => {
    await assertFails(getDoc(doc(alice(), 'secrets', 'x')));
    await assertFails(setDoc(doc(alice(), 'secrets', 'x'), { a: 1 }));
  });
});
