import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

import { db } from "./firebaseAdmin";

type SprintCounts = { good: number; bad: number; action: number };

const emptyCounts = (): SprintCounts => ({ good: 0, bad: 0, action: 0 });

/**
 * Keeps sprints/{id}.counts in step with the notes underneath it, so the landing
 * page can render its per-category counters straight from the sprint document
 * instead of reading every note of every sprint on screen.
 *
 * Counted by query rather than tracked with increment(), because a note flipping
 * published false -> true changes the total without being created or deleted, so
 * there is no single delta to apply.
 *
 * The read and the write share a transaction on purpose. Recomputing is
 * idempotent but not convergent: with several notes written at once, a delivery
 * whose query ran early can commit its stale total after a later one, and since
 * nothing writes again there is nothing to correct it.
 */
export const syncSprintCounts = onDocumentWritten(
  "sprints/{sprintId}/items/{itemId}",
  async (event) => {
    const { sprintId } = event.params;
    const sprintRef = db.collection("sprints").doc(sprintId);
    const publishedItems = sprintRef.collection("items").where("published", "==", true);

    const counts = await db.runTransaction(async (transaction) => {
      const sprint = await transaction.get(sprintRef);
      // The whole sprint may have been deleted, taking its items with it.
      if (!sprint.exists) return null;

      const snapshot = await transaction.get(publishedItems);

      const totals = emptyCounts();
      snapshot.forEach((doc) => {
        const category = doc.data().category as keyof SprintCounts;
        if (category in totals) totals[category] += 1;
      });

      transaction.update(sprintRef, { counts: totals });
      return totals;
    });

    if (counts) logger.debug("Synced sprint counts", { sprintId, counts });
  }
);
