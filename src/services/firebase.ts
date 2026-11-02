import { getApp, getApps, initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, reauthenticateWithPopup, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { SUBJECT_COLORS, subjectCode } from '../lib/records';
import type { AcademicNote, AcademicProfile, AcademicSetup, Assessment, ClassSession, GradingWeights, HistoricalGrade, Subject, SubjectGradingWeights, Task } from '../types/app';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredConfig = Object.values(firebaseConfig);
export const firebaseConfigured = requiredConfig.every(value => Boolean(value));

const app = firebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export const firebaseAuth = app ? getAuth(app) : null;
export const firestore = app ? getFirestore(app) : null;

let driveTokenCache: { uid: string; accessToken: string; expiresAt: number } | null = null;
const driveFolderCache = new Map<string, string>();

async function getDriveAccessToken(uid: string): Promise<string> {
  const { auth } = requireFirebase();
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error('Sign in again before accessing Google Drive.');
  if (driveTokenCache?.uid === uid && driveTokenCache.expiresAt > Date.now() + 60_000) return driveTokenCache.accessToken;
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  const result = await reauthenticateWithPopup(user, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;
  if (!accessToken) throw new Error('Google did not provide Drive access. Try connecting again.');
  driveTokenCache = { uid, accessToken, expiresAt: Date.now() + 50 * 60_000 };
  return accessToken;
}

async function driveRequest(uid: string, url: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = await getDriveAccessToken(uid);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const details = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(details.error?.message || `Google Drive request failed (${response.status}). Enable the Google Drive API in your Google Cloud project, then reconnect.`);
  }
  return response;
}

async function getDriveFolderId(uid: string): Promise<string> {
  const cached = driveFolderCache.get(uid);
  if (cached) return cached;
  const query = encodeURIComponent("name='AMPlifier Notes' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  const found = await driveRequest(uid, `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`);
  const files = await found.json() as { files?: Array<{ id: string }> };
  let folderId = files.files?.[0]?.id;
  if (!folderId) {
    const created = await driveRequest(uid, 'https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'AMPlifier Notes', mimeType: 'application/vnd.google-apps.folder' }),
    });
    folderId = (await created.json() as { id: string }).id;
  }
  driveFolderCache.set(uid, folderId);
  return folderId;
}

export async function uploadNoteAttachment(uid: string, noteId: string, file: File): Promise<string> {
  const folderId = await getDriveFolderId(uid);
  const accessToken = await getDriveAccessToken(uid);
  const metadata = { name: file.name, mimeType: file.type, parents: [folderId], appProperties: { amplifierNoteId: noteId } };
  const start = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'X-Upload-Content-Type': file.type || 'application/octet-stream', 'X-Upload-Content-Length': String(file.size) },
    body: JSON.stringify(metadata),
  });
  if (!start.ok) {
    const details = await start.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(details.error?.message || 'Could not start the Google Drive upload. Enable the Google Drive API, then reconnect.');
  }
  const uploadUrl = start.headers.get('Location');
  if (!uploadUrl) throw new Error('Google Drive did not return an upload URL. Try again.');
  const response = await fetch(uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': file.type || 'application/octet-stream' }, body: file });
  if (!response.ok) {
    const details = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(details.error?.message || `Google Drive upload failed (${response.status}).`);
  }
  return (await response.json() as { id: string }).id;
}

export async function downloadNoteAttachment(uid: string, fileId: string): Promise<Blob> {
  const response = await driveRequest(uid, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
  return response.blob();
}

export async function deleteDriveAttachment(uid: string, fileId: string): Promise<void> {
  await driveRequest(uid, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
}

export async function connectGoogleDrive(uid: string): Promise<void> {
  await getDriveAccessToken(uid);
  await getDriveFolderId(uid);
}

export type UserSettings = Record<string, unknown>;

function requireFirebase() {
  if (!firebaseAuth || !firestore) {
    throw new Error('Firebase is not configured. Copy .env.example to .env.local and add your Firebase web app configuration.');
  }
  return { auth: firebaseAuth, db: firestore };
}

export async function signInWithGoogle(): Promise<User> {
  const { auth } = requireFirebase();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  const { auth } = requireFirebase();
  await signOut(auth);
}

export async function ensureUserDocument(user: User): Promise<void> {
  const { db } = requireFirebase();
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      photoURL: user.photoURL ?? '',
      settings: {},
      setupCompleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function getUserSettings(uid: string): Promise<UserSettings | null> {
  const { db } = requireFirebase();
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) return null;
  const settings = snapshot.data().settings;
  return settings && typeof settings === 'object' ? settings as UserSettings : {};
}

export type UserWorkspace = {
  setupCompleted: boolean;
  profile: AcademicProfile | null;
  subjects: Subject[];
  settings: UserSettings;
  assessments: Assessment[] | null;
  tasks: Task[] | null;
  historicalGrades: HistoricalGrade[] | null;
  schedule: ClassSession[] | null;
};

function workspaceFromData(data: Record<string, unknown> | undefined): UserWorkspace {
  return {
    setupCompleted: data?.setupCompleted === true,
    profile: data?.profile && typeof data.profile === 'object' ? data.profile as AcademicProfile : null,
    subjects: Array.isArray(data?.subjects) ? data.subjects as Subject[] : [],
    settings: data?.settings && typeof data.settings === 'object' ? data.settings as UserSettings : {},
    assessments: Array.isArray(data?.assessments) ? data.assessments as Assessment[] : null,
    tasks: Array.isArray(data?.tasks) ? data.tasks as Task[] : null,
    historicalGrades: Array.isArray(data?.historicalGrades) ? data.historicalGrades as HistoricalGrade[] : null,
    schedule: Array.isArray(data?.schedule) ? data.schedule as ClassSession[] : null,
  };
}

export async function getUserWorkspace(uid: string): Promise<UserWorkspace> {
  const { db } = requireFirebase();
  const snapshot = await getDoc(doc(db, 'users', uid));
  return workspaceFromData(snapshot.exists() ? snapshot.data() : undefined);
}

/** `local` is true when the snapshot only echoes this device's not-yet-acknowledged writes. */
export function subscribeUserWorkspace(uid: string, onChange: (workspace: UserWorkspace, local: boolean) => void, onError: (error: Error) => void): () => void {
  const { db } = requireFirebase();
  return onSnapshot(doc(db, 'users', uid), snapshot => {
    onChange(workspaceFromData(snapshot.exists() ? snapshot.data() : undefined), snapshot.metadata.hasPendingWrites);
  }, onError);
}

export type WorkspacePatch = {
  subjects?: Subject[];
  assessments?: Assessment[];
  tasks?: Task[];
  historicalGrades?: HistoricalGrade[];
  schedule?: ClassSession[];
  profile?: AcademicProfile;
};

/** Replaces the given top-level workspace fields (arrays are written whole). */
export async function saveUserRecords(uid: string, records: WorkspacePatch): Promise<void> {
  const { db } = requireFirebase();
  await setDoc(doc(db, 'users', uid), { ...records, updatedAt: serverTimestamp() }, { merge: true });
}

/** Moves every note filed under subject `from` to subject `to`. */
export async function renameSubjectInNotes(uid: string, from: string, to: string): Promise<void> {
  const { db } = requireFirebase();
  const snapshot = await getDocs(query(collection(db, 'users', uid, 'notes'), where('subject', '==', from)));
  if (snapshot.empty) return;
  const batch = writeBatch(db);
  snapshot.docs.forEach(item => batch.update(item.ref, { subject: to }));
  await batch.commit();
}

export function subscribeUserNotes(uid: string, onChange: (notes: AcademicNote[]) => void, onError: (error: Error) => void): () => void {
  const { db } = requireFirebase();
  return onSnapshot(query(collection(db, 'users', uid, 'notes'), orderBy('updatedAt', 'desc')), snapshot => {
    onChange(snapshot.docs.map(item => ({ ...item.data(), id: item.id } as AcademicNote)));
  }, onError);
}

export async function saveUserNote(uid: string, note: AcademicNote): Promise<void> {
  const { db } = requireFirebase();
  await setDoc(doc(db, 'users', uid, 'notes', note.id), note, { merge: true });
}

export async function deleteUserNote(uid: string, noteId: string): Promise<void> {
  const { db } = requireFirebase();
  await deleteDoc(doc(db, 'users', uid, 'notes', noteId));
}

export async function saveAcademicSetup(uid: string, setup: AcademicSetup): Promise<void> {
  const { db } = requireFirebase();
  const subjects: Subject[] = setup.subjects.map((subject, index) => ({
    id: index + 1,
    name: subject.name.trim(),
    code: subjectCode(subject.name),
    color: SUBJECT_COLORS[index % SUBJECT_COLORS.length],
    grade: 0,
    change: 0,
    ww: 0,
    pt: 0,
    exam: 0,
    hasBaseline: false,
  }));
  const gradingWeights: SubjectGradingWeights = Object.fromEntries(setup.subjects.map(subject => [subject.name.trim(), subject.weights as GradingWeights]));
  const username = setup.profile.username?.trim().toLowerCase();
  if (!username || !/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('Use a username with 3–20 letters, numbers, or underscores.');
  await runTransaction(db, async transaction => {
    const usernameRef = doc(db, 'usernames', username);
    const usernameSnapshot = await transaction.get(usernameRef);
    if (usernameSnapshot.exists() && usernameSnapshot.data().uid !== uid) throw new Error('That @username is already taken. Try another one.');
    transaction.set(usernameRef, { uid, handle: username, updatedAt: serverTimestamp() }, { merge: true });
    transaction.set(doc(db, 'users', uid), {
      setupCompleted: true,
      profile: setup.profile,
      subjects,
      assessments: [],
      tasks: [],
      historicalGrades: [],
      schedule: [],
      settings: { gradingWeights, period: setup.period },
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}

export async function saveUsernameProfile(uid: string, displayName: string, usernameValue: string): Promise<void> {
  const { db } = requireFirebase();
  const username = usernameValue.trim().toLowerCase();
  const cleanName = displayName.trim().slice(0, 40);
  if (cleanName.length < 2) throw new Error('Enter a display name with at least 2 characters.');
  if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('Use a username with 3–20 letters, numbers, or underscores.');
  await runTransaction(db, async transaction => {
    const usernameRef = doc(db, 'usernames', username);
    const userRef = doc(db, 'users', uid);
    const [usernameSnapshot, userSnapshot] = await Promise.all([transaction.get(usernameRef), transaction.get(userRef)]);
    if (usernameSnapshot.exists() && usernameSnapshot.data().uid !== uid) throw new Error('That @username is already taken. Try another one.');
    const userProfile = userSnapshot.data()?.profile;
    transaction.set(usernameRef, { uid, handle: username, updatedAt: serverTimestamp() }, { merge: true });
    transaction.set(userRef, { profile: { ...(userProfile && typeof userProfile === 'object' ? userProfile : {}), displayName: cleanName, username }, updatedAt: serverTimestamp() }, { merge: true });
  });
}

/**
 * Writes only the given settings keys. Each key is replaced as a whole (so removed subjects or cleared
 * assumptions do not linger in nested maps) and untouched keys are left alone.
 */
export async function saveUserSettings(uid: string, settings: UserSettings): Promise<void> {
  const { db } = requireFirebase();
  const userRef = doc(db, 'users', uid);
  const fields = Object.fromEntries(Object.entries(settings).map(([key, value]) => [`settings.${key}`, value]));
  try {
    await updateDoc(userRef, { ...fields, updatedAt: serverTimestamp() });
  } catch (error) {
    if ((error as { code?: string })?.code !== 'not-found') throw error;
    await setDoc(userRef, { uid, settings, updatedAt: serverTimestamp() }, { merge: true });
  }
}

