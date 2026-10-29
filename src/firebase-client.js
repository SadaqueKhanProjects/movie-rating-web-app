import { initializeApp, deleteApp } from "firebase/app";
import {
  initializeAuth,
  browserSessionPersistence,
  inMemoryPersistence,
  connectAuthEmulator,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  applyActionCode,
} from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
  connectFirestoreEmulator,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  terminate,
} from "firebase/firestore";
import {
  filmData,
  decodeCloud,
  sameFilm,
  assertRevision,
} from "../dist/account-model.js";
export async function createAccountService(
  config,
  { emulators = false, appName = "frame-accounts" } = {},
) {
  if (!config?.apiKey || !config?.projectId || !config?.authDomain)
    throw new Error(
      "Accounts have not been configured yet. Your browser diary is still available.",
    );
  if (
    emulators &&
    (!config.projectId.startsWith("demo-") ||
      (typeof location !== "undefined" &&
        !["localhost", "127.0.0.1"].includes(location.hostname)))
  )
    throw new Error("Emulator mode is limited to a local demo project.");
  const app = initializeApp(config, appName);
  const auth = initializeAuth(app, {
    persistence:
      typeof window === "undefined"
        ? inMemoryPersistence
        : browserSessionPersistence,
  });
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  if (emulators) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  function owner(uid) {
    if (
      !uid ||
      auth.currentUser?.uid !== uid ||
      !auth.currentUser.emailVerified
    )
      throw new Error(
        "Sign in and verify your email to use your private diary.",
      );
  }
  function ref(uid, id) {
    return doc(db, "users", uid, "films", id);
  }
  const service = {
    watchAuth: (callback) => onAuthStateChanged(auth, callback),
    signIn: (email, password) =>
      signInWithEmailAndPassword(auth, email, password),
    async signUp(email, password) {
      if (password.length < 12)
        throw new Error("Use a password with at least 12 characters.");
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      // Account creation succeeded even if email delivery fails. Keep it signed in so resend is possible.
      try {
        await sendEmailVerification(result.user);
        return { verificationSent: true };
      } catch {
        return { verificationSent: false };
      }
    },
    async resetPassword(email) {
      try {
        await sendPasswordResetEmail(auth, email);
      } catch (error) {
        if (error.code !== "auth/user-not-found") throw error;
      }
    },
    signOut: () => signOut(auth),
    resendVerification() {
      if (!auth.currentUser) throw new Error("Sign in first.");
      return sendEmailVerification(auth.currentUser);
    },
    async refreshUser() {
      if (!auth.currentUser) return null;
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      return auth.currentUser;
    },
    watchFilms(uid, next, error) {
      owner(uid);
      return onSnapshot(
        collection(db, "users", uid, "films"),
        { includeMetadataChanges: true },
        (snapshot) => {
          // A memory cache is not authoritative on a fresh sign-in; wait for a server snapshot.
          if (snapshot.metadata.fromCache) return;
          try {
            const films = snapshot.docs.map((item) => {
              const record = decodeCloud(item.data());
              if (record.id !== item.id)
                throw new Error("A saved film has an invalid ID.");
              return record;
            });
            next(films);
          } catch (failure) {
            error(failure);
          }
        },
        error,
      );
    },
    async putFilm(uid, film, expectedRevision) {
      owner(uid);
      const data = filmData(film);
      await runTransaction(db, async (transaction) => {
        owner(uid);
        const target = ref(uid, data.id),
          snapshot = await transaction.get(target);
        const record = snapshot.exists() ? decodeCloud(snapshot.data()) : null;
        assertRevision(record, expectedRevision);
        transaction.set(target, {
          ...data,
          revision: (record?.revision ?? 0) + 1,
          updatedAt: serverTimestamp(),
        });
      });
    },
    async removeFilm(uid, film) {
      owner(uid);
      const data = filmData(film);
      await runTransaction(db, async (transaction) => {
        owner(uid);
        const target = ref(uid, data.id),
          snapshot = await transaction.get(target);
        assertRevision(
          snapshot.exists() ? decodeCloud(snapshot.data()) : null,
          film.revision,
        );
        transaction.delete(target);
      });
    },
    async importFilms(uid, films) {
      owner(uid);
      if (films.length > 200)
        throw new Error(
          "Import is limited to 200 films at a time. Your local journal is unchanged.",
        );
      const data = films.map(filmData);
      if (new Set(data.map((f) => f.id)).size !== data.length)
        throw new Error("Duplicate film IDs cannot be imported.");
      return runTransaction(db, async (transaction) => {
        owner(uid);
        const snapshots = await Promise.all(
          data.map((f) => transaction.get(ref(uid, f.id))),
        );
        let imported = 0;
        // Validate every conflict before writing; import is all-or-nothing and repeatable.
        snapshots.forEach((snapshot, i) => {
          if (
            snapshot.exists() &&
            !sameFilm(decodeCloud(snapshot.data()), data[i])
          )
            throw new Error(
              "An account film conflicts with a browser film. No films were imported; both copies are preserved.",
            );
        });
        snapshots.forEach((snapshot, i) => {
          if (!snapshot.exists()) {
            transaction.set(ref(uid, data[i].id), {
              ...data[i],
              revision: 1,
              updatedAt: serverTimestamp(),
            });
            imported++;
          }
        });
        return imported;
      });
    },
    // For local integration tests only; the browser uses Firebase's email action handler.
    verifyCode: (code) => applyActionCode(auth, code),
    async close() {
      await terminate(db);
      await deleteApp(app);
    },
  };
  return service;
}
