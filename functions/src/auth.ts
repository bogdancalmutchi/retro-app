import { CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { authAdmin, db } from "./firebaseAdmin";
import { allowedOrigins } from "./config";

const MIN_PASSWORD_LENGTH = 10;
const MAX_DISPLAY_NAME_LENGTH = 40;
const MAX_TEAM_NAME_LENGTH = 64;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * A 256-bit token cannot usefully be guessed, so these caps are about the bill
 * rather than about access: they bound how much compute a burst of calls to the
 * unauthenticated endpoints can buy.
 */
const PUBLIC_CALLABLE = { cors: allowedOrigins, maxInstances: 5, timeoutSeconds: 30 };
const ADMIN_CALLABLE = { cors: allowedOrigins, maxInstances: 2, timeoutSeconds: 30 };

/**
 * Only the hash is stored, so a Firestore backup or an accidentally widened
 * rule leaks nothing usable: the plaintext token exists solely in the link the
 * admin sends, and is unrecoverable afterwards.
 */
const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

/**
 * Every failure mode of a token collapses to this one message. Distinguishing
 * "no such invite" from "already used" would confirm which tokens exist.
 */
const INVALID_INVITE = "This invite link is not valid or has expired.";

const requireAdmin = (request: CallableRequest) => {
  if (request.auth?.token?.isAdmin !== true) {
    throw new HttpsError("permission-denied", "Admins only.");
  }
};

/**
 * Admin-only: mints a single-use invite and returns the token once.
 *
 * Registration used to be an unauthenticated callable gated only on the email
 * domain, which is published in this repository, so anyone could mint an
 * account and read every retro. An invite is now the gate.
 *
 * The returned token is the only copy: Firestore holds its hash. Losing it
 * means issuing a new invite, which is the same trade real products make.
 */
export const createInvite = onCall(ADMIN_CALLABLE, async (request) => {
  requireAdmin(request);

  const email = asString(request.data?.email).trim().toLowerCase();
  const team = asString(request.data?.team).trim();

  if (!email || !team) {
    throw new HttpsError("invalid-argument", "An email address and a team are required.");
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new HttpsError("invalid-argument", "That email address is not valid.");
  }
  if (team.length > MAX_TEAM_NAME_LENGTH) {
    throw new HttpsError("invalid-argument", "That team name is not valid.");
  }

  const existing = await authAdmin.getUserByEmail(email).catch(() => null);
  if (existing) {
    throw new HttpsError("already-exists", "That address already has an account.");
  }

  const token = randomBytes(32).toString("base64url");
  const now = Date.now();

  await db.collection("invites").doc(hashToken(token)).set({
    email,
    team,
    createdBy: request.auth?.uid ?? null,
    createdAt: new Date(now),
    expiresAt: new Date(now + INVITE_TTL_MS),
    usedAt: null,
    revokedAt: null,
  });

  logger.info("Invite created", { email, team, createdBy: request.auth?.uid });

  return { ok: true, token, email, team, expiresAt: new Date(now + INVITE_TTL_MS).toISOString() };
});

/**
 * Unauthenticated: tells the invite page who a token is for, so an expired or
 * revoked link fails before the invitee fills in a form. Tokens are 256 bits of
 * randomness, so this is not a useful thing to probe.
 */
export const checkInvite = onCall(PUBLIC_CALLABLE, async (request) => {
  const token = asString(request.data?.token);
  if (!token) {
    throw new HttpsError("invalid-argument", INVALID_INVITE);
  }

  const snapshot = await db.collection("invites").doc(hashToken(token)).get();
  const invite = snapshot.data();

  if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt.toMillis() < Date.now()) {
    throw new HttpsError("not-found", INVALID_INVITE);
  }

  return { ok: true, email: invite.email, team: invite.team };
});

/**
 * Unauthenticated: exchanges a valid invite for an account.
 *
 * The email and team come from the invite document, never from the payload, so
 * a token cannot be redeemed for a different address or to join another team.
 * isAdmin is hard-coded false and any value in the payload is ignored.
 */
export const redeemInvite = onCall(PUBLIC_CALLABLE, async (request) => {
  const token = asString(request.data?.token);
  const displayName = asString(request.data?.displayName).trim();
  const password = asString(request.data?.password);

  if (!token || !displayName || !password) {
    throw new HttpsError("invalid-argument", "All fields are required.");
  }
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `Name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    );
  }

  const inviteRef = db.collection("invites").doc(hashToken(token));

  // Claim the invite before creating anything. Two people racing the same link
  // both reach this transaction, but only one commits the usedAt stamp, so the
  // other is rejected before an account exists. Auth work cannot join a
  // Firestore transaction, hence claim-then-create rather than one atomic step.
  const invite = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(inviteRef);
    const current = snapshot.data();

    if (
      !current ||
      current.usedAt ||
      current.revokedAt ||
      current.expiresAt.toMillis() < Date.now()
    ) {
      throw new HttpsError("not-found", INVALID_INVITE);
    }

    transaction.update(inviteRef, { usedAt: new Date() });
    return current;
  });

  const uid = randomUUID();

  try {
    await authAdmin.createUser({
      uid,
      email: invite.email,
      password,
      displayName,
    });

    await authAdmin.setCustomUserClaims(uid, { isAdmin: false, team: invite.team });

    await db.collection("users").doc(uid).set({
      id: uid,
      email: invite.email,
      displayName,
      team: invite.team,
      canParty: false,
      isAdmin: false,
      hasTempPassword: false,
    });
  } catch (err) {
    // Hand the invite back rather than burning it on a failure that was not the
    // invitee's fault.
    await inviteRef.update({ usedAt: null }).catch(() => undefined);

    if ((err as { code?: string }).code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "That address already has an account.");
    }
    throw err;
  }

  logger.info("Invite redeemed", { uid, team: invite.team });

  return { ok: true, email: invite.email, team: invite.team };
});

/** Admin-only: burns an outstanding invite. */
export const revokeInvite = onCall(ADMIN_CALLABLE, async (request) => {
  requireAdmin(request);

  const tokenHash = asString(request.data?.tokenHash).trim();
  if (!tokenHash) {
    throw new HttpsError("invalid-argument", "An invite id is required.");
  }

  const inviteRef = db.collection("invites").doc(tokenHash);
  if (!(await inviteRef.get()).exists) {
    throw new HttpsError("not-found", "That invite does not exist.");
  }

  await inviteRef.update({ revokedAt: new Date() });
  return { ok: true };
});

/**
 * Admin-only: lists invites for the admin page. The rules deny the client any
 * read of this collection, and the tokens are unrecoverable anyway, so the
 * listing goes through here and returns the hash as the handle for revoking.
 */
export const listInvites = onCall(ADMIN_CALLABLE, async (request) => {
  requireAdmin(request);

  const snapshot = await db.collection("invites").orderBy("createdAt", "desc").limit(100).get();

  return {
    ok: true,
    invites: snapshot.docs.map((doc) => {
      const invite = doc.data();
      return {
        tokenHash: doc.id,
        email: invite.email,
        team: invite.team,
        createdAt: invite.createdAt?.toDate().toISOString() ?? null,
        expiresAt: invite.expiresAt?.toDate().toISOString() ?? null,
        usedAt: invite.usedAt?.toDate().toISOString() ?? null,
        revokedAt: invite.revokedAt?.toDate().toISOString() ?? null,
      };
    }),
  };
});

/**
 * Admin-only: replaces a user's password with one the admin chooses and flags
 * the profile so the app forces a change at next sign-in.
 *
 * Deliver the temporary password out of band, over chat. Firebase's own reset
 * emails do not arrive: the corporate mail server rejects external senders.
 * Prefer an invite link where you can, since that never puts a password in a
 * message at all.
 */
export const setTempPassword = onCall(ADMIN_CALLABLE, async (request) => {
  requireAdmin(request);

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
