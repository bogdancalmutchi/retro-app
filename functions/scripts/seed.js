#!/usr/bin/env node
/**
 * Seeds the local emulators with enough data to actually use the app.
 *
 *   npm run seed
 *
 * Refuses to run unless the emulator host variables are set, so it can never
 * point at production. Safe to run repeatedly: it deletes what it created first.
 *
 * Creates, for team Protoss: one open sprint plus 14 closed ones, which is two
 * pages of archive at the landing page's page size of 8. Team Tigers is left
 * with no sprints at all so the empty state is reachable without deleting
 * anything.
 *
 * Sign in with any of the accounts printed at the end.
 */

const admin = require("firebase-admin");

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error(
    "Refusing to run: FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST are not set.\n" +
    "Use `npm run seed`, which sets them, and make sure the emulators are running."
  );
  process.exit(1);
}

const PASSWORD = "retro-local-pass";

const USERS = [
  { uid: "seed-alice", displayName: "Alice Admin", email: "alice@example.com", team: "Protoss", isAdmin: true },
  { uid: "seed-bob", displayName: "Bob Baker", email: "bob@example.com", team: "Protoss", isAdmin: false },
  { uid: "seed-carol", displayName: "Carol Chen", email: "carol@example.com", team: "Protoss", isAdmin: false },
  { uid: "seed-dave", displayName: "Dave Diaz", email: "dave@example.com", team: "Tigers", isAdmin: false },
];

const CLOSED_TITLES = [
  "Sprint 47 — Payments hardening",
  "Sprint 46 — Search relevance",
  "Sprint 45 — Onboarding polish",
  "Sprint 44 — Infra cleanup",
  "Q2 Wrap-up",
  "Sprint 43 — Notification rework",
  "Sprint 42 — Mobile nav",
  "Sprint 41 — Billing migration",
  "Sprint 40 — Flaky test purge",
  "Sprint 39 — Design tokens",
  "Sprint 38 — Cache layer",
  "Sprint 37 — Audit logging",
  "Sprint 36 — Export pipeline",
  "Sprint 35 — Rate limiting",
];

const GOOD_NOTES = [
  "Pairing on the tricky migration paid off",
  "Deploys were boring this sprint, in a good way",
  "The new runbook meant on-call was quiet",
  "Design got involved early for once",
];
const BAD_NOTES = [
  "Standups drifted past 25 minutes most days",
  "Two of us picked up the same ticket on Tuesday",
  "Staging was broken for a day and a half",
  "Requirements changed after implementation started",
];
const ACTION_NOTES = [
  "Timebox standup and move detail to the thread",
  "Assign tickets before the sprint starts, not during",
  "Add a staging smoke test to the deploy",
];

const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "retro-app-a95ca" });
const db = admin.firestore();
const auth = admin.auth();

const SEED_EPOCH = new Date("2026-08-17T09:00:00Z");
const sprintDate = (index) =>
  new Date(SEED_EPOCH.getTime() - index * 14 * 24 * 60 * 60 * 1000);

const buildNotes = (authors, isOpenSprint) => {
  const notes = [];
  const push = (text, category, published) => {
    const author = authors[notes.length % authors.length];
    notes.push({
      text,
      category,
      createdBy: author,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      published,
      likes: 0,
      dislikes: 0,
      votes: {},
      order: notes.length,
    });
  };

  GOOD_NOTES.slice(0, 3).forEach((text) => push(text, "good", true));
  BAD_NOTES.slice(0, 3).forEach((text) => push(text, "bad", true));
  ACTION_NOTES.slice(0, 2).forEach((text) => push(text, "action", true));

  if (isOpenSprint) {
    push("Draft: still deciding how to phrase this one", "good", false);
  }

  notes[0].votes = { "seed-carol": 1, "seed-alice": 1 };
  notes[0].likes = 2;
  notes[3].votes = { "seed-bob": -1 };
  notes[3].dislikes = 1;

  return notes;
};

const deleteSeeded = async () => {
  const sprints = await db.collection("sprints").where("seeded", "==", true).get();
  for (const sprint of sprints.docs) {
    const items = await sprint.ref.collection("items").get();
    const batch = db.batch();
    items.docs.forEach((item) => batch.delete(item.ref));
    batch.delete(sprint.ref);
    await batch.commit();
  }
  console.log(`Removed ${sprints.size} previously seeded sprint(s).`);
};

const seedUsers = async () => {
  for (const user of USERS) {
    await auth.deleteUser(user.uid).catch(() => undefined);
    await auth.createUser({
      uid: user.uid,
      email: user.email,
      password: PASSWORD,
      displayName: user.displayName,
    });
    await auth.setCustomUserClaims(user.uid, { isAdmin: user.isAdmin, team: user.team });
    await db.collection("users").doc(user.uid).set({
      id: user.uid,
      email: user.email,
      displayName: user.displayName,
      team: user.team,
      canParty: false,
      isAdmin: user.isAdmin,
      hasTempPassword: false,
    });
  }
  console.log(`Created ${USERS.length} user(s).`);
};

const seedSprints = async () => {
  const protoss = USERS.filter((user) => user.team === "Protoss").map((user) => user.uid);

  const write = async (title, isOpen, index) => {
    const sprintRef = await db.collection("sprints").add({
      title,
      team: "Protoss",
      isOpen,
      createdAt: sprintDate(index),
      celebrating: false,
      summary: isOpen ? "" : "The team shipped the planned work and agreed to tighten up standups.",
      seeded: true,
    });

    const batch = db.batch();
    buildNotes(protoss, isOpen).forEach((note) => {
      batch.set(sprintRef.collection("items").doc(), note);
    });
    await batch.commit();
  };

  await write("Sprint 48 — Checkout rewrite", true, 0);
  for (let i = 0; i < CLOSED_TITLES.length; i += 1) {
    await write(CLOSED_TITLES[i], false, i + 1);
  }
  console.log(`Created 1 open and ${CLOSED_TITLES.length} closed sprint(s) for Protoss.`);
  console.log("Left team Tigers with no sprints, so the empty state is reachable.");
};

(async () => {
  try {
    await deleteSeeded();
    await seedUsers();
    await seedSprints();

    console.log("\nDone. Sign in at http://localhost:5173 with:");
    USERS.forEach((user) => {
      console.log(`  ${user.email}  /  ${PASSWORD}${user.isAdmin ? "   (admin)" : ""}`);
    });
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await app.delete();
  }
})();
