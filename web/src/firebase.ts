import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App singleton
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with configured databaseId if present, otherwise use default
const customDbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = customDbId && customDbId !== '(default)'
  ? getFirestore(app, customDbId)
  : getFirestore(app);

// Autenticación: la sesión se conserva en el teléfono (IndexedDB, con respaldo en localStorage).
// initializeAuth (y no getAuth) evita depender de popups/redirect, que no existen en la WebView de Android.
function createAuth(a: FirebaseApp): Auth {
  try {
    return initializeAuth(a, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  } catch {
    return getAuth(a);
  }
}
export const auth = createAuth(app);
auth.languageCode = 'es';
export const googleProvider = new GoogleAuthProvider();

// ============================================================================
// INICIO DE SESIÓN CON CORREO Y CONTRASEÑA
// ============================================================================
const normEmail = (email: string) => email.trim().toLowerCase();

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, normEmail(email), password);
  return cred.user;
}

export async function registerWithEmail(name: string, email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, normEmail(email), password);
  if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() }).catch(() => undefined);
  return cred.user;
}

/** Envía el correo de Firebase para crear / restablecer la contraseña. */
export async function sendPasswordEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, normEmail(email));
}

/**
 * Invitación: crea la cuenta del invitado (con una app secundaria, para no cerrar la
 * sesión del administrador) y le envía el correo para que elija su contraseña.
 * Si el correo ya tiene cuenta, solo se envía el correo de contraseña.
 */
export async function createInvitedAccount(email: string): Promise<'created' | 'existing'> {
  const e = normEmail(email);
  const secondary = getApps().find((a) => a.name === 'invitaciones') || initializeApp(firebaseConfig, 'invitaciones');
  let secondaryAuth: Auth;
  try {
    secondaryAuth = initializeAuth(secondary, { persistence: inMemoryPersistence });
  } catch {
    secondaryAuth = getAuth(secondary);
  }
  let result: 'created' | 'existing' = 'created';
  try {
    // Contraseña aleatoria: el invitado la reemplaza con el enlace del correo
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    const tmp = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') + 'Aa1!';
    await createUserWithEmailAndPassword(secondaryAuth, e, tmp);
    await signOut(secondaryAuth).catch(() => undefined);
  } catch (err: any) {
    if (err?.code !== 'auth/email-already-in-use') throw err;
    result = 'existing';
  }
  await sendPasswordResetEmail(auth, e);
  return result;
}

/** Mensaje en español para los errores de Firebase Auth. */
export function authErrorMessage(err: unknown): string {
  const code = (err as any)?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'El correo no es válido.';
    case 'auth/missing-password':
      return 'Escribe tu contraseña.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con este correo. Inicia sesión o usa "¿Olvidaste tu contraseña?".';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    case 'auth/network-request-failed':
      return 'Sin conexión a internet. Revisa tu conexión e inténtalo de nuevo.';
    case 'auth/user-disabled':
      return 'Esta cuenta fue deshabilitada.';
    case 'auth/operation-not-allowed':
      return 'El inicio de sesión con correo no está habilitado en Firebase.';
    default:
      return (err as any)?.message ? `No se pudo completar: ${(err as any).message}` : 'No se pudo completar la operación.';
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase Firestore connection test successful.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is in offline mode or waiting for connection.');
    } else {
      console.info('Firebase connection status note:', error);
    }
    return false;
  }
}

export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error logging in with Google:', error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}
