#!/usr/bin/env node
/**
 * Backfills sprints/{id}.counts for sprints created before the syncSprintCounts
 * trigger existed.
 *
 *   Dry run (default, writes nothing):
 *     npm run backfill:counts
 *
 *   Apply:
 *     npm run backfill:counts -- --apply
 *
 * Against production, authenticate first with `firebase login` (the CLI's
 * credentials are picked up automatically), or set
 * GOOGLE_APPLICATION_CREDENTIALS. When the emulator env vars are set it targets
 * the emulator instead.
 *
 * Counts published notes only, matching what the cards render and what the
 * trigger writes. Safe to run more than once: it recomputes from scratch and
 * skips sprints whose stored counts already agree.
 */

const admin = require("firebase-admin");

const APPLY = process.argv.includes("--apply");

const app = admin.initializeApp({
  projectId: process.env.GCLOUD_PROJECT || "retro-app-a95ca",
});
const db = admin.firestore();

const target = process.env.FIRESTORE_EMULATOR_HOST
  ? `emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`
  : "PRODUCTION";

const countPublished = async (sprintRef) => {
  const snapshot = await sprintRef.collection("items").where("published", "==", true).get();
  const counts = { good: 0, bad: 0, action: 0 };
  snapshot.forEach((doc) => {
    const category = doc.data().category;
    if (category in counts) counts[category] += 1;
  });
  return counts;
};

const same = (a, b) =>
  !!a && a.good === b.good && a.bad === b.bad && a.action === b.action;

(async () => {
  try {
    console.log(`${APPLY ? "APPLYING to" : "Dry run against"} ${target}\n`);

    const sprints = await db.collection("sprints").get();
    let written = 0;
    let unchanged = 0;

    for (const sprint of sprints.docs) {
      const counts = await countPublished(sprint.ref);
      const existing = sprint.data().counts;

      if (same(existing, counts)) {
        unchanged += 1;
        continue;
      }

      const title = sprint.data().title || "(untitled)";
      console.log(
        `${sprint.id}  ${title}\n` +
        `    ${JSON.stringify(existing ?? null)} -> ${JSON.stringify(counts)}`
      );

      if (APPLY) await sprint.ref.update({ counts });
      written += 1;
    }

    console.log(
      `\n${sprints.size} sprint(s): ${written} ${APPLY ? "updated" : "would be updated"}, ` +
      `${unchanged} already correct.`
    );
    if (!APPLY && written) console.log("Re-run with -- --apply to write.");
  } catch (error) {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  } finally {
    await app.delete();
  }
})();
