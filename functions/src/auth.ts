import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { randomUUID } from "node:crypto";

import { authAdmin, db } from "./firebaseAdmin";
import { allowedOrigins } from "./config";

const ALLOWED_SIGNUP_DOMAIN = "@intralinks.com";
const MIN_PASSWORD_LENGTH = 10;
const MAX_DISPLAY_NAME_LENGTH = 40;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * Self-service registration for the allowed email domain.
 *
 * Firebase Auth stores and verifies the password; nothing here ever sees a
 * hash. The role is hard-coded to false: the old client-side version granted
 * isAdmin to anything ending in @admin.com, and its domain check read
 * `!endsWith(a) || !endsWith(b)`, which is true for every possible input, so
 * ordinary signups always failed and the only working path was the admin one.
 *
 * The client signs in with email and password afterwards, as normal.
 */
export const signup = onCall({ cors: allowedOrigins }, async (request) => {
  const displayName = asString(request.data?.displayName).trim();
  const email = asString(request.data?.email).trim().toLowerCase();
  const password = asString(request.data?.password);
  const team = asString(request.data?.team).trim();

  if (!displayName || !email || !password || !team) {
    throw new HttpsError("invalid-argument", "All fields are required.");
  }
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `Name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`
    );
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new HttpsError("invalid-argument", "That email address is not valid.");
  }
  if (!email.endsWith(ALLOWED_SIGNUP_DOMAIN)) {
    throw new HttpsError(
      "permission-denied",
      `Only ${ALLOWED_SIGNUP_DOMAIN} addresses can register.`
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    );
  }
  if (team.length > 64) {
    throw new HttpsError("invalid-argument", "That team name is not valid.");
  }

  // The document id has always been a uuid, and note.createdBy / presenterId
  // and the avatar seeds all reference it, so the Auth uid is pinned to one.
  const uid = randomUUID();

  // Auth's unique-email constraint is what settles a race between two
  // simultaneous signups for the same address.
  try {
    await authAdmin.createUser({ uid, email, password, displayName });
  } catch (err) {
    if ((err as { code?: string }).code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "An account with this email already exists.");
    }
    throw err;
  }

  await authAdmin.setCustomUserClaims(uid, { isAdmin: false, team });

  await db.collection("users").doc(uid).set({
    id: uid,
    email,
    displayName,
    team,
    canParty: false,
    isAdmin: false,
    hasTempPassword: false,
  });

  return { ok: true, team };
});

/**
 * Admin-only: replaces a user's password with one the admin chooses and flags
 * the profile so the app forces a change at next sign-in.
 *
 * Deliver the temporary password out of band. The @intralinks.com mail server
 * rejects external senders, so Firebase's own reset emails never arrive.
 */
export const setTempPassword = onCall({ cors: allowedOrigins }, async (request) => {
  if (request.auth?.token?.isAdmin !== true) {
    throw new HttpsError("permission-denied", "Admins only.");
  }

  const uid = asString(request.data?.uid).trim();
  const tempPassword = asString(request.data?.tempPassword);

  if (!uid) {
    throw new HttpsError("invalid-argument", "A user id is required.");
  }
  if (tempPassword.length < MIN_PASSWORD_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `Temporary password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    );
  }

  const userRef = db.collection("users").doc(uid);
  if (!(await userRef.get()).exists) {
    throw new HttpsError("not-found", "That user does not exist.");
  }

  try {
    await authAdmin.updateUser(uid, { password: tempPassword });
  } catch (err) {
    if ((err as { code?: string }).code === "auth/user-not-found") {
      throw new HttpsError("not-found", "That user has no sign-in account.");
    }
    throw err;
  }

  await userRef.update({ hasTempPassword: true });

  // Boot any active session so the temporary password actually takes effect.
  await authAdmin.revokeRefreshTokens(uid).catch(() => undefined);

  return { ok: true };
});

/**
 * Keeps the isAdmin / team custom claims in step with the profile document.
 *
 * The security rules trust the claim rather than the document, so granting
 * admin by editing Firestore in the console would otherwise have no effect
 * until someone remembered to run a script.
 */
export const syncUserClaims = onDocumentWritten("users/{uid}", async (event) => {
  if (!event.data?.after?.exists) return; // deleted; nothing to sync

  const uid = event.params.uid;

  // Deliberately re-read the document instead of using event.data.after.
  // Trigger delivery is not ordered, so acting on the event's own snapshot lets
  // a late create event overwrite the claim a later update event already set,
  // leaving the role permanently stale. Reading current state converges no
  // matter what order the events arrive in.
  const current = await db.collection("users").doc(uid).get();
  if (!current.exists) return;

  const profile = current.data() ?? {};
  const claims = { isAdmin: profile.isAdmin === true, team: profile.team ?? null };

  try {
    const user = await authAdmin.getUser(uid);
    const existing = user.customClaims ?? {};
    if (existing.isAdmin === claims.isAdmin && (existing.team ?? null) === claims.team) {
      return;
    }
    await authAdmin.setCustomUserClaims(uid, claims);
    logger.info("Synced custom claims from profile", { uid, isAdmin: claims.isAdmin });
  } catch (err) {
    if ((err as { code?: string }).code === "auth/user-not-found") {
      // A profile can exist before its Auth account during migration.
      return;
    }
    throw err;
  }
});
