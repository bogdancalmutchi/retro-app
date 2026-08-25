/**
 * How long a sign-in stays valid before the user has to authenticate again.
 *
 * This value is enforced twice on purpose:
 *
 *  - firestore.rules refuses requests from an older session, which is the part
 *    a browser cannot bypass
 *  - UserContext signs the user out once it notices, so they get sent to the
 *    login page instead of watching the app fail with permission errors
 *
 * The rules cannot import this file, so the same number is written there as a
 * millisecond literal. Change both together.
 */
export const SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000;
