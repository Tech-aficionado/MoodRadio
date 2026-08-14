import { auth } from '@/lib/firebase';

/**
 * Resolves a Firebase ID token for AI requests.
 *
 * Firebase restores a persisted session asynchronously, so `auth.currentUser`
 * is null for the first moments after page load even for a signed-in user.
 * Reading it directly caused `NO_ID_TOKEN` and a silent drop to the non-AI
 * fallback, so we wait for the initial state to settle first.
 *
 * MoodRadio now requires sign-in to use, so there is no anonymous path: if
 * there is no user here, the caller is being used outside the sign-in gate.
 */
export async function ensureIdToken(): Promise<string | null> {
  try {
    await auth.authStateReady();
  } catch {
    // Non-fatal: fall through and inspect currentUser directly.
  }

  if (!auth.currentUser) return null;

  try {
    return await auth.currentUser.getIdToken();
  } catch (err) {
    console.warn('[AUTH] Could not mint ID token for current user:', err);
    return null;
  }
}
