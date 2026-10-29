import { validate } from "./core.js";
export const FILM_FIELDS = [
  "id",
  "title",
  "genre",
  "score",
  "watched",
  "review",
];
export function filmData(film) {
  validate(film);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(film.id))
    throw new Error(
      "This film has an unsupported ID. The original record is preserved.",
    );
  return Object.fromEntries(FILM_FIELDS.map((key) => [key, film[key]]));
}
export function sameFilm(a, b) {
  return FILM_FIELDS.every((key) => a[key] === b[key]);
}
export function decodeCloud(data) {
  const film = filmData(data);
  if (!Number.isSafeInteger(data.revision) || data.revision < 1)
    throw new Error("The saved account film has an unsupported revision.");
  return { ...film, revision: data.revision };
}
export function assertRevision(record, expected) {
  if ((record?.revision ?? null) !== expected)
    throw new Error(
      "This film changed on another device. Close and reopen it before saving. Your draft is still here.",
    );
}
export function authMessage(error) {
  const messages = {
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/user-not-found": "The email or password is incorrect.",
    "auth/wrong-password": "The email or password is incorrect.",
    "auth/email-already-in-use":
      "This account could not be created. Try signing in or resetting your password.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Use a password with at least 12 characters.",
    "auth/too-many-requests":
      "Too many attempts. Please wait before trying again.",
    "auth/network-request-failed":
      "Could not connect. Check your connection and try again.",
    "auth/operation-not-allowed":
      "Email sign-in is not enabled for this app yet.",
    "permission-denied":
      "Access was denied. Check that your email is verified and try again.",
    unavailable:
      "The account service is unavailable. Your draft is still here; reconnect and try again.",
  };
  return (
    messages[error?.code] ||
    (error?.code
      ? "The account service could not complete that action. Please try again."
      : error?.message || "Something went wrong. Please try again.")
  );
}
