import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filmData,
  decodeCloud,
  assertRevision,
  sameFilm,
  authMessage,
} from "../dist/account-model.js";
const film = {
  id: "synthetic-one",
  title: "Test film",
  genre: "Drama",
  score: 8.5,
  watched: "2026-01-01",
  review: "Synthetic review",
};
test("account records contain only supported user fields", () => {
  assert.deepEqual(
    filmData({ ...film, revision: 4, owner: "not-trusted" }),
    film,
  );
  assert.throws(() => filmData({ ...film, id: "other/path" }));
});
test("cloud records require valid revisions and film data", () => {
  assert.equal(decodeCloud({ ...film, revision: 1 }).revision, 1);
  for (const revision of [undefined, 0, -1, 1.5, "1"])
    assert.throws(() => decodeCloud({ ...film, revision }));
  assert.throws(() => decodeCloud({ ...film, revision: 1, score: 11 }));
});
test("stale create/edit/delete snapshots are rejected", () => {
  assert.doesNotThrow(() => assertRevision(null, null));
  assert.doesNotThrow(() => assertRevision({ revision: 2 }, 2));
  assert.throws(() => assertRevision({ revision: 2 }, 1), /another device/);
  assert.throws(() => assertRevision({ revision: 1 }, null));
  assert.throws(() => assertRevision(null, 1));
});
test("import equality ignores sync metadata but preserves user edits", () => {
  assert.equal(sameFilm(film, { ...film, revision: 2 }), true);
  assert.equal(sameFilm(film, { ...film, review: "Different" }), false);
});
test("authentication errors do not reveal raw provider messages", () => {
  assert.equal(
    authMessage({
      code: "auth/invalid-credential",
      message: "internal details",
    }),
    "The email or password is incorrect.",
  );
  assert.equal(
    authMessage({
      code: "auth/unknown",
      message: "sensitive details",
    }).includes("sensitive"),
    false,
  );
});
