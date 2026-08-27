#!/usr/bin/env node
/**
 * One-off migration to Firebase Auth email/password.
 *
 *   Dry run (default, writes nothing):
 *     npm run migrate
 *
 *   Apply:
 *     npm run migrate -- --apply
 *
 * Against production this needs Application Default Credentials: either
 * `gcloud auth application-default login`, or GOOGLE_APPLICATION_CREDENTIALS
 * pointing at a service-account key. `firebase login` is NOT enough - the CLI's
 * credentials are not visible to the Admin SDK. With the emulator env vars set
 * it targets the emulator instead and needs no credentials.
 *
 * For each user document it:
 *   1. deletes the leaked bcrypt passwordHash from the profile
 *   2. lowercases the stored email so lookups are predictable
 *   3. makes sure a Firebase Auth account exists whose uid equals the Firestore
 *      document id, deleting any account holding that address under a different
 *      uid, and sets a freshly generated temporary password
 *   4. sets the isAdmin / team custom claims and flags hasTempPassword
 *
 * It also deletes leftover anonymous Auth accounts, which have no email, no
 * password and no provider.
 *
 * Passwords are rotated rather than carried over on purpose: the old hashes were
 * publicly readable, so they are treated as compromised.
 *
 * On --apply it prints one temporary password per user. Send them out of band
 * over chat; Firebase's own reset emails do not arrive, because the corporate
 * mail server rejects external senders. Each user is forced to choose their own
 * password at first sign-in.
 *
 * Safe to run more than once, though re-running rotates the temporary passwords
 * again for anyone still flagged.
 */

const admin = require("firebase-admin");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const APPLY = process.argv.includes("--apply");

function resolveProjectId() {
  const fromEnv =
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT;
  if (fromEnv) return fromEnv;

  try {
    const rc = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "..", ".firebaserc"), "utf8")
    );
    return rc.projects && rc.projects.default;
  } catch {
    return undefined;
  }
}

const projectId = resolveProjectId();
if (!projectId) {
  console.error("Could not determine the project id. Set GCLOUD_PROJECT.");
  process.exit(1);
}

admin.initializeApp({ projectId });
const db = admin.firestore();
const auth = admin.auth();
const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

/** Readable, unambiguous temporary password: no 0/O/1/l/I. */
function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const groups = [];
  for (let g = 0; g < 3; g += 1) {
    let group = "";
    for (let i = 0; i < 4; i += 1) {
      group += alphabet[crypto.randomInt(alphabet.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

const planned = [];
const issued = []; // { email, tempPassword }
const counts = {
  hashesRemoved: 0,
  emailsLowercased: 0,
  authCreated: 0,
  authEmailFixed: 0,
  passwordsRotated: 0,
  mismatchedAuthDeleted: 0,
  anonymousAuthDeleted: 0,
  claimsSet: 0,
  skippedNoEmail: 0,
};

function plan(description, run) {
  planned.push({ description, run });
}

async function getAuthUser(getter) {
  try {
    return await getter();
  } catch (err) {
    if (err && err.code === "auth/user-not-found") return null;
    throw err;
  }
}

async function buildPlanForUser(snapshot) {
  const uid = snapshot.id;
  const data = snapshot.data() || {};
  const rawEmail = typeof data.email === "string" ? data.email : "";
  const email = rawEmail.trim().toLowerCase();
  const displayName = typeof data.displayName === "string" ? data.displayName : undefined;

  // 1. The leaked hash has no purpose now that Firebase holds the password.
  if (typeof data.passwordHash === "string" && data.passwordHash) {
    counts.hashesRemoved += 1;
    plan(`[${uid}] delete leaked passwordHash from the profile`, async () => {
      await snapshot.ref.update({ passwordHash: admin.firestore.FieldValue.delete() });
    });
  }

  // 2. Normalise the stored email.
  if (rawEmail && rawEmail !== email) {
    counts.emailsLowercased += 1;
    plan(`[${uid}] lowercase stored email -> ${email}`, async () => {
      await snapshot.ref.update({ email });
    });
  }

  if (!email) {
    counts.skippedNoEmail += 1;
    console.warn(`[${uid}] no email on the profile; cannot create a sign-in account`);
    return;
  }

  // 3. Reconcile the Auth account and set a temporary password.
  const byUid = await getAuthUser(() => auth.getUser(uid));
  const byEmail = await getAuthUser(() => auth.getUserByEmail(email));
  const mismatched = byEmail && byEmail.uid !== uid ? byEmail : null;
  const tempPassword = generateTempPassword();
  issued.push({ email, tempPassword });

  if (mismatched) {
    counts.mismatchedAuthDeleted += 1;
    plan(
      `[${uid}] DELETE Auth account ${mismatched.uid} holding ${email} under the wrong uid`,
      async () => {
        await auth.deleteUser(mismatched.uid);
      }
    );
  }

  if (!byUid) {
    counts.authCreated += 1;
    plan(`[${uid}] create Auth account for ${email} with a temporary password`, async () => {
      await auth.createUser({
        uid,
        email,
        password: tempPassword,
        ...(displayName ? { displayName } : {}),
      });
    });
  } else {
    if (byUid.email !== email) {
      counts.authEmailFixed += 1;
    }
    counts.passwordsRotated += 1;
    plan(`[${uid}] set a temporary password for ${email}`, async () => {
      await auth.updateUser(uid, {
        email,
        password: tempPassword,
        ...(displayName ? { displayName } : {}),
      });
    });
  }

  // 4. Claims, and force a password change at first sign-in.
  const claims = { isAdmin: data.isAdmin === true, team: data.team ?? null };
  counts.claimsSet += 1;
  plan(
    `[${uid}] set claims isAdmin=${claims.isAdmin} team=${JSON.stringify(claims.team)} ` +
      `and flag hasTempPassword`,
    async () => {
      await auth.setCustomUserClaims(uid, claims);
      await snapshot.ref.update({ hasTempPassword: true });
    }
  );
}

async function buildPlanForAnonymousAccounts(realUids) {
  const anonymous = [];
  let pageToken;

  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      const looksAnonymous =
        !user.email &&
        !user.phoneNumber &&
        (!user.providerData || user.providerData.length === 0);
      // Never touch an account that backs a real profile.
      if (looksAnonymous && !realUids.has(user.uid)) {
        anonymous.push(user.uid);
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);

  if (anonymous.length === 0) return;

  counts.anonymousAuthDeleted += anonymous.length;
  plan(`DELETE ${anonymous.length} leftover anonymous Auth account(s)`, async () => {
    // deleteUsers takes at most 1000 ids per call.
    for (let i = 0; i < anonymous.length; i += 1000) {
      await auth.deleteUsers(anonymous.slice(i, i + 1000));
    }
  });
}

async function main() {
  console.log(`project: ${projectId}${usingEmulator ? " (emulator)" : ""}`);
  console.log(`mode:    ${APPLY ? "APPLY - writes will happen" : "DRY RUN - nothing will be written"}`);
  console.log("");

  const users = await db.collection("users").get();
  console.log(`found ${users.size} user document(s)`);
  console.log("");

  for (const snapshot of users.docs) {
    await buildPlanForUser(snapshot);
  }
  await buildPlanForAnonymousAccounts(new Set(users.docs.map((d) => d.id)));

  if (planned.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  console.log(`${planned.length} action(s) ${APPLY ? "to run" : "that would run"}:`);
  for (const item of planned) {
    console.log(`  - ${item.description}`);
  }
  console.log("");

  if (!APPLY) {
    console.log("Dry run complete. Re-run with --apply to perform these actions.");
    console.log("Temporary passwords are generated at apply time and printed then.");
    return;
  }

  for (const item of planned) {
    await item.run();
  }

  console.log("All actions applied.");
  console.log("");
  console.log("Temporary passwords - send each of these to its owner over Slack.");
  console.log("They will be forced to choose their own password at first sign-in.");
  console.log("");
  const width = Math.max(...issued.map((i) => i.email.length));
  for (const { email, tempPassword } of issued) {
    console.log(`  ${email.padEnd(width)}   ${tempPassword}`);
  }
  console.log("");
  console.log("summary:");
  for (const [key, value] of Object.entries(counts)) {
    if (value) console.log(`  ${key}: ${value}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
