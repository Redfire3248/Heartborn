import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut as fbSignOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { connectAuthEmulator, initializeAuth, inMemoryPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { firebaseConfig } from './config.js';

// Local emulator (tests, or the dev server with ?emu in the URL) — never touches the real project.
const EMULATOR = !!globalThis.HB_EMULATOR
  || (typeof location !== 'undefined' && import.meta.env?.DEV && new URLSearchParams(location.search).has('emu'));
const config = EMULATOR
  ? { ...firebaseConfig, projectId: 'demo-hearthborn', databaseURL: 'http://127.0.0.1:9000?ns=demo-hearthborn-default-rtdb' }
  : firebaseConfig;

export const app = initializeApp(config);
// on the emulator each tab is its own player, so sign-ins are not shared between tabs
export const auth = EMULATOR ? initializeAuth(app, { persistence: inMemoryPersistence, popupRedirectResolver: typeof window !== 'undefined' ? browserPopupRedirectResolver : undefined }) : getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
if (EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);
}

// finish a redirect sign-in if the popup was blocked earlier
if (typeof window !== 'undefined') getRedirectResult(auth).catch(() => {});

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-environment') {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw e;
  }
}

export const signInWithEmail = (email, password) => signInWithEmailAndPassword(auth, email.trim(), password).then(c => c.user);
export const createAccount = (email, password) => createUserWithEmailAndPassword(auth, email.trim(), password).then(c => c.user);
export const resetPassword = email => sendPasswordResetEmail(auth, email.trim());

export const signOut = () => fbSignOut(auth);
export const onAuth = cb => onAuthStateChanged(auth, cb);

/** Admin if the database lists this UID under admins/ (the security rules check the same list). */
export async function isAdmin(user) {
  return (await adminStatus(user)) === 'admin';
}

/** 'admin' | 'not-listed' (no admins/{uid} doc) | 'rules' (Firestore rules not published) | 'error' */
export async function adminStatus(user) {
  if (!user?.uid) return 'error';
  try {
    return (await getDoc(doc(db, 'admins', user.uid))).exists() ? 'admin' : 'not-listed';
  } catch (e) {
    return e?.code === 'permission-denied' ? 'rules' : 'error';
  }
}

export function friendlyAuthError(e) {
  const map = {
    'auth/popup-closed-by-user': 'Sign-in window was closed.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/unauthorized-domain': 'This domain is not authorized in Firebase (Authentication → Settings → Authorized domains).',
    'auth/operation-not-allowed': 'Google sign-in is not enabled in the Firebase console.',
    'auth/network-request-failed': 'Network error — check your connection.',
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'No account with that email. Create one below.',
    'auth/email-already-in-use': 'That email already has an account — sign in instead.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'That email address looks wrong.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
    'auth/missing-password': 'Enter your password.',
  };
  if (/firestore\.googleapis\.com|Cloud Firestore API/i.test(e?.message || '')) {
    return 'The cloud database is not set up yet. In the Firebase console open Firestore Database → Create database, then try again.';
  }
  return map[e?.code] || e?.message || 'Sign-in failed.';
}
