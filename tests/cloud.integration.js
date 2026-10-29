import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { createAccountService } from "../src/firebase-client.js";
const config = {
  apiKey: "demo-frame-public-key",
  authDomain: "demo-frame.firebaseapp.com",
  projectId: "demo-frame",
  appId: "demo-frame",
};
const fixture = (patch) => ({
  id: "synthetic-" + randomUUID(),
  title: "Synthetic account film",
  genre: "Drama",
  score: 8.5,
  watched: "2026-01-01",
  review: "A synthetic integration review.",
  ...patch,
});
function current(name) {
  return getAuth(getApp(name)).currentUser;
}
async function verify(service, name, email) {
  const response = await fetch(
    "http://127.0.0.1:9099/emulator/v1/projects/demo-frame/oobCodes",
  );
  const data = await response.json();
  const code = data.oobCodes
    .filter((x) => x.email === email && x.requestType === "VERIFY_EMAIL")
    .at(-1).oobCode;
  await service.verifyCode(code);
  await service.refreshUser();
  assert.equal(current(name).emailVerified, true);
}
function list(service, uid) {
  return new Promise((resolve, reject) => {
    let stop = () => {};
    const timer = setTimeout(() => {
      stop();
      reject(new Error("Timed out waiting for server films"));
    }, 10000);
    stop = service.watchFilms(
      uid,
      (films) => {
        clearTimeout(timer);
        stop();
        resolve(films);
      },
      (error) => {
        clearTimeout(timer);
        stop();
        reject(error);
      },
    );
  });
}
test(
  "Firebase authentication and private diary security",
  { timeout: 90000 },
  async (t) => {
    assert.equal(process.env.GCLOUD_PROJECT, "demo-frame");
    assert.match(
      process.env.FIRESTORE_EMULATOR_HOST ?? "",
      /^(127\.0\.0\.1|localhost):8080$/,
    );
    assert.match(
      process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "",
      /^(127\.0\.0\.1|localhost):9099$/,
    );
    const suffix = randomUUID(),
      nameA = "test-a-" + suffix,
      nameB = "test-b-" + suffix;
    const a = await createAccountService(config, {
      emulators: true,
      appName: nameA,
    });
    const b = await createAccountService(config, {
      emulators: true,
      appName: nameB,
    });
    const emailA = `a-${suffix}@example.test`,
      emailB = `b-${suffix}@example.test`,
      password = "Synthetic-only-password-42";
    try {
      await a.signUp(emailA, password);
      const uidA = current(nameA).uid;
      const aDb = getFirestore(getApp(nameA)),
        bDb = getFirestore(getApp(nameB));
      await t.test(
        "unverified accounts and anonymous requests cannot read private records",
        async () => {
          assert.throws(
            () =>
              a.watchFilms(
                uidA,
                () => {},
                () => {},
              ),
            /verify/,
          );
          await assert.rejects(
            getDoc(doc(aDb, "users", uidA, "films", "hidden")),
            (error) => error.code === "permission-denied",
          );
          const response = await fetch(
            `http://127.0.0.1:8080/v1/projects/demo-frame/databases/(default)/documents/users/${uidA}/films`,
          );
          assert.equal(response.status, 403);
        },
      );
      await verify(a, nameA, emailA);
      await b.signUp(emailB, password);
      await verify(b, nameB, emailB);
      const uidB = current(nameB).uid;
      const film = fixture();
      await t.test(
        "verified owner creates and reads a film; another account cannot read/write/delete it",
        async () => {
          await a.putFilm(uidA, film, null);
          assert.equal(
            (await list(a, uidA)).find((x) => x.id === film.id).score,
            8.5,
          );
          const other = doc(bDb, "users", uidA, "films", film.id);
          await assert.rejects(
            getDoc(other),
            (error) => error.code === "permission-denied",
          );
          await assert.rejects(
            deleteDoc(other),
            (error) => error.code === "permission-denied",
          );
          await assert.rejects(
            setDoc(other, {
              ...film,
              revision: 2,
              updatedAt: serverTimestamp(),
            }),
            (error) => error.code === "permission-denied",
          );
          assert.deepEqual(await list(b, uidB), []);
        },
      );
      await t.test(
        "revision checks prevent stale edits and deletion",
        async () => {
          await a.putFilm(uidA, { ...film, score: 0 }, 1);
          await assert.rejects(
            a.putFilm(uidA, { ...film, score: 4 }, 1),
            /another device/,
          );
          await assert.rejects(
            a.removeFilm(uidA, { ...film, revision: 1 }),
            /another device/,
          );
          assert.equal(
            (await list(a, uidA)).find((x) => x.id === film.id).score,
            0,
          );
        },
      );
      await t.test(
        "rules reject malformed films even when bypassing client validation",
        async () => {
          for (const patch of [
            { score: 11 },
            { review: "x".repeat(601) },
            { genre: "untrusted" },
            { extra: "not-allowed" },
            { revision: 99 },
          ]) {
            const data = {
              ...fixture(),
              revision: 1,
              updatedAt: serverTimestamp(),
              ...patch,
            };
            await assert.rejects(
              setDoc(doc(aDb, "users", uidA, "films", data.id), data),
              (error) => error.code === "permission-denied",
            );
          }
        },
      );
      await t.test(
        "independent sessions sync the same owner and reject stale writes",
        async () => {
          await b.signOut();
          await b.signIn(emailA, password);
          await b.putFilm(uidA, { ...film, score: 9 }, 2);
          assert.equal(
            (await list(a, uidA)).find((x) => x.id === film.id).score,
            9,
          );
          await assert.rejects(
            a.putFilm(uidA, { ...film, score: 4 }, 2),
            /another device/,
          );
        },
      );
      await t.test(
        "import is repeatable and conflicts preserve every original",
        async () => {
          const local = fixture();
          assert.equal(await a.importFilms(uidA, [local]), 1);
          assert.equal(await a.importFilms(uidA, [local]), 0);
          const fresh = fixture();
          await assert.rejects(
            a.importFilms(uidA, [
              fresh,
              { ...local, review: "Conflicting browser review" },
            ]),
            /conflicts/,
          );
          const all = await list(a, uidA);
          assert.equal(
            all.some((x) => x.id === fresh.id),
            false,
          );
          assert.equal(all.find((x) => x.id === local.id).review, local.review);
        },
      );
      await t.test(
        "sign-out denies operations, sign-in restores access, password reset can be requested",
        async () => {
          await a.signOut();
          await assert.rejects(a.putFilm(uidA, fixture(), null), /Sign in/);
          await a.signIn(emailA, password);
          assert.equal(current(nameA).uid, uidA);
          await a.resetPassword(emailA);
          const links = await (
            await fetch(
              "http://127.0.0.1:9099/emulator/v1/projects/demo-frame/oobCodes",
            )
          ).json();
          assert.ok(
            links.oobCodes.some(
              (x) => x.email === emailA && x.requestType === "PASSWORD_RESET",
            ),
          );
          await a.removeFilm(uidA, { ...film, revision: 3 });
          assert.equal(
            (await list(a, uidA)).some((x) => x.id === film.id),
            false,
          );
        },
      );
    } finally {
      await a.close();
      await b.close();
    }
  },
);
