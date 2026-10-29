import { KEY, GENRES, DEMO, today, read, save, filterFilms } from "./core.js";
import { accountConfig, useEmulators } from "./account-config.js";
import { authMessage, sameFilm } from "./account-model.js";
const $ = (s) => document.querySelector(s);
let films = [],
  raw = null,
  demo = false,
  blocked = false,
  editing = null,
  draftRaw = null,
  deleting = null,
  deleteRaw = null,
  toastTimer,
  returnFilmId = null;
const dialog = $("#film-dialog"),
  form = $("#film-form");
let accountServicePromise,
  accountService,
  accountUser = null;
let authEpoch = 0,
  stopAccountFilms = () => {},
  accountReady = false;
let writeBusy = false,
  authBusy = false,
  authMode = "signin";
let draftId = null,
  draftRevision = null,
  importSnapshot = null;
async function getAccounts() {
  if (!accountConfig)
    throw new Error(
      "Accounts are not configured on this version yet. Your browser diary is unchanged.",
    );
  if (!accountServicePromise)
    accountServicePromise = import("./vendor/accounts.js")
      .then((module) =>
        module.createAccountService(accountConfig, { emulators: useEmulators }),
      )
      .then((service) => {
        accountService = service;
        service.watchAuth(setAccountUser);
        return service;
      })
      .catch((error) => {
        accountServicePromise = null;
        throw error;
      });
  return accountServicePromise;
}
function updateAccountControls() {
  document
    .querySelectorAll(".add-button")
    .forEach((button) => (button.disabled = blocked || writeBusy));
  $("#signin-button").hidden = !!accountUser;
  $("#account-menu").hidden = !accountUser;
  $("#account-email").textContent = accountUser?.email ?? "";
  $("#signout-button").disabled = writeBusy || authBusy;
  $("#verify-notice").hidden = !accountUser || accountUser.emailVerified;
  $("#storage-label").textContent = accountUser
    ? !navigator.onLine
      ? "Private account · offline"
      : accountReady
        ? "Private account · synced"
        : "Private account · not synced yet"
    : "Saved in this browser only";
  $("#import-notice").hidden = true;
  if (accountUser?.emailVerified && accountReady && !demo) {
    try {
      const local = read(localStorage);
      const missing = local.films.filter(
        (film) => !films.some((existing) => sameFilm(film, existing)),
      );
      if (missing.length) {
        $("#import-summary").textContent =
          `${missing.length} browser film${missing.length === 1 ? "" : "s"} can be imported into ${accountUser.email}.`;
        $("#import-notice").hidden = false;
      }
    } catch {
      /* Unreadable guest data is preserved and never uploaded automatically. */
    }
  }
  $("#import-open").disabled = blocked || writeBusy;
  document
    .querySelectorAll(".option-menu button")
    .forEach((button) => (button.disabled = blocked || writeBusy));
}
function accountStatus(message) {
  $("#account-status").textContent = message;
  $("#account-status").hidden = !message;
}
function setAccountUser(user) {
  const epoch = ++authEpoch;
  stopAccountFilms();
  stopAccountFilms = () => {};
  accountUser = user;
  accountReady = false;
  films = [];
  raw = null;
  demo = false;
  writeBusy = false;
  deleting = null;
  editing = null;
  draftId = null;
  draftRevision = null;
  returnFilmId = null;
  // Remove private records and drafts immediately whenever the authenticated actor changes.
  for (const id of ["film-dialog", "delete-dialog", "import-dialog"])
    if ($("#" + id).open) $("#" + id).close();
  form.reset();
  $("#import-description").textContent = "";
  $("#delete-description").textContent = "";
  $("#storage-error").hidden = true;
  if (!user) {
    accountStatus("");
    load();
    return;
  }
  blocked = true;
  reset();
  if (!user.emailVerified) {
    accountStatus(
      "Check your inbox to verify your email, then choose “I’ve verified my email”.",
    );
    render();
    return;
  }
  accountStatus("Loading your private diary…");
  try {
    stopAccountFilms = accountService.watchFilms(
      user.uid,
      (records) => {
        if (epoch !== authEpoch) return;
        films = records;
        accountReady = true;
        blocked = !navigator.onLine;
        accountStatus(
          blocked
            ? "Offline. Your account diary is read-only until you reconnect."
            : "",
        );
        $("#storage-error").hidden = true;
        render();
      },
      (error) => {
        if (epoch !== authEpoch) return;
        films = [];
        accountReady = false;
        blocked = true;
        $("#storage-error").textContent =
          `Could not load your private diary. ${authMessage(error)}`;
        $("#storage-error").hidden = false;
        accountStatus(
          "Account sync stopped. Sign out and sign in again to retry.",
        );
        render();
      },
    );
  } catch (error) {
    accountStatus(authMessage(error));
    render();
  }
}
function showAuth(mode = "signin") {
  authMode = mode;
  $("#auth-message").hidden = true;
  $("#auth-title").textContent =
    mode === "signup"
      ? "Create account"
      : mode === "reset"
        ? "Reset password"
        : "Sign in";
  $("#auth-description").textContent =
    mode === "signup"
      ? "Use at least 12 characters for your password. Verify your email before syncing films."
      : mode === "reset"
        ? "Enter your email to request a password reset link."
        : "Open your private film diary on any device.";
  $("#auth-submit").textContent =
    mode === "signup"
      ? "Create account"
      : mode === "reset"
        ? "Send reset email"
        : "Sign in";
  $("#password-field").hidden = mode === "reset";
  $("#auth-password").required = mode !== "reset";
  $("#auth-password").minLength = mode === "signup" ? 12 : 1;
  $("#auth-password").autocomplete =
    mode === "signup" ? "new-password" : "current-password";
  $("#confirm-field").hidden = mode !== "signup";
  $("#auth-confirm").required = mode === "signup";
  $("#auth-reset").hidden = mode !== "signin";
  $("#auth-mode-toggle").textContent =
    mode === "signin" ? "Create an account" : "Back to sign in";
  $("#auth-password").value = "";
  $("#auth-confirm").value = "";
  if (!$("#auth-dialog").open) $("#auth-dialog").showModal();
  $("#auth-email").focus();
}
$("#signin-button").onclick = () => showAuth();
$("#auth-close").onclick = () => {
  if (!authBusy) $("#auth-dialog").close();
};
$("#auth-dialog").addEventListener("close", () => {
  $("#auth-password").value = "";
  $("#auth-confirm").value = "";
  if (!accountUser) $("#signin-button").focus();
});
$("#auth-dialog").addEventListener("cancel", (event) => {
  if (authBusy) event.preventDefault();
});
$("#auth-mode-toggle").onclick = () => {
  if (!authBusy) showAuth(authMode === "signin" ? "signup" : "signin");
};
$("#auth-reset").onclick = () => {
  if (!authBusy) showAuth("reset");
};
$("#auth-form").onsubmit = async (event) => {
  event.preventDefault();
  if (authBusy) return;
  $("#auth-message").hidden = true;
  if (
    authMode === "signup" &&
    $("#auth-password").value !== $("#auth-confirm").value
  ) {
    $("#auth-message").textContent = "The passwords do not match.";
    $("#auth-message").hidden = false;
    return;
  }
  authBusy = true;
  $("#auth-submit").disabled = true;
  $("#auth-close").disabled = true;
  try {
    const service = await getAccounts();
    if (authMode === "reset") {
      await service.resetPassword($("#auth-email").value.trim());
      $("#auth-message").textContent =
        "If an account exists for that email, a reset link has been sent. Check your inbox and spam folder.";
      $("#auth-message").hidden = false;
    } else if (authMode === "signup") {
      const result = await service.signUp(
        $("#auth-email").value.trim(),
        $("#auth-password").value,
      );
      $("#auth-dialog").close();
      announce(
        result.verificationSent
          ? "Account created. Check your email to verify it."
          : "Account created, but the verification email could not be sent. Choose Resend email.",
      );
    } else {
      await service.signIn(
        $("#auth-email").value.trim(),
        $("#auth-password").value,
      );
      $("#auth-dialog").close();
    }
  } catch (error) {
    $("#auth-message").textContent = authMessage(error);
    $("#auth-message").hidden = false;
  } finally {
    authBusy = false;
    $("#auth-submit").disabled = false;
    $("#auth-close").disabled = false;
    updateAccountControls();
  }
};
$("#signout-button").onclick = async () => {
  if (writeBusy || authBusy) return;
  authBusy = true;
  updateAccountControls();
  try {
    await accountService.signOut();
    $("#account-menu").open = false;
    $("#auth-form").reset();
    announce("Signed out. Your private diary has been cleared from this page.");
  } catch (error) {
    announce(authMessage(error));
  } finally {
    authBusy = false;
    updateAccountControls();
  }
};
$("#verification-send").onclick = async () => {
  if (authBusy) return;
  authBusy = true;
  $("#verification-send").disabled = true;
  try {
    await accountService.resendVerification();
    announce("Verification email sent. Check your inbox and spam folder.");
  } catch (error) {
    announce(authMessage(error));
  } finally {
    authBusy = false;
    $("#verification-send").disabled = false;
  }
};
$("#verification-check").onclick = async () => {
  if (authBusy) return;
  authBusy = true;
  $("#verification-check").disabled = true;
  try {
    const user = await accountService.refreshUser();
    setAccountUser(user);
    if (user && !user.emailVerified)
      announce(
        "Your email is not verified yet. Open the link in your email first.",
      );
  } catch (error) {
    announce(authMessage(error));
  } finally {
    authBusy = false;
    $("#verification-check").disabled = false;
  }
};
function setWriteBusy(value) {
  writeBusy = value;
  document
    .querySelectorAll(
      "#film-dialog button, #delete-dialog button, #import-dialog button",
    )
    .forEach((button) => (button.disabled = value));
  updateAccountControls();
}
for (const id of ["film-dialog", "delete-dialog", "import-dialog"])
  $("#" + id).addEventListener("cancel", (event) => {
    if (writeBusy) event.preventDefault();
  });
$("#import-open").onclick = () => {
  if (blocked || writeBusy || !accountUser?.emailVerified) return;
  try {
    importSnapshot = {
      ...read(localStorage),
      uid: accountUser.uid,
      epoch: authEpoch,
    };
    $("#import-description").textContent =
      `Import ${importSnapshot.films.length} browser film(s) into ${accountUser.email}?`;
    $("#import-error").hidden = true;
    $("#import-dialog").showModal();
    $("#import-cancel").focus();
  } catch (error) {
    announce(authMessage(error));
  }
};
$("#import-cancel").onclick = () => {
  if (!writeBusy) $("#import-dialog").close();
};
$("#import-confirm").onclick = async () => {
  if (writeBusy || !importSnapshot) return;
  const epoch = authEpoch;
  setWriteBusy(true);
  try {
    if (
      epoch !== importSnapshot.epoch ||
      accountUser?.uid !== importSnapshot.uid
    )
      throw new Error("The signed-in account changed. Reopen import.");
    if (read(localStorage).raw !== importSnapshot.raw)
      throw new Error(
        "The browser diary changed. Close and reopen import to review the latest films.",
      );
    if (!navigator.onLine)
      throw new Error(
        "Reconnect before importing. Your browser films are unchanged.",
      );
    const count = await accountService.importFilms(
      importSnapshot.uid,
      importSnapshot.films,
    );
    if (epoch !== authEpoch) return;
    $("#import-dialog").close();
    announce(`${count} film(s) imported. Browser originals were kept.`);
  } catch (error) {
    if (epoch === authEpoch) {
      $("#import-error").textContent = authMessage(error);
      $("#import-error").hidden = false;
    }
  } finally {
    if (epoch === authEpoch) setWriteBusy(false);
  }
};
$("#import-dialog").addEventListener("close", () => {
  importSnapshot = null;
  $("#import-open").focus();
});
window.addEventListener("offline", () => {
  if (accountUser) {
    blocked = true;
    accountStatus("Offline. Reconnect to save changes to your private diary.");
    render();
  }
});
window.addEventListener("online", () => {
  if (accountUser) {
    blocked = !accountReady;
    accountStatus(accountReady ? "" : "Waiting for account sync…");
    render();
  }
});
async function initializeAccounts() {
  if (!accountConfig) {
    load();
    return;
  }
  blocked = true;
  accountStatus("Checking your account…");
  render();
  try {
    await getAccounts();
  } catch (error) {
    setAccountUser(null);
    accountStatus(
      `Accounts unavailable. ${authMessage(error)} You can still use your browser diary.`,
    );
  }
}

function announce(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 4000);
}
function load() {
  if (accountUser) {
    render();
    return;
  }
  try {
    ({ films, raw } = read(localStorage));
    blocked = false;
    $("#storage-error").hidden = true;
  } catch (error) {
    blocked = true;
    $("#storage-error").textContent =
      `Journal unavailable: ${error.message} Saved data will not be overwritten. If browser storage is blocked, enable it and reload this page.`;
    $("#storage-error").hidden = false;
  }
  document
    .querySelectorAll(".add-button")
    .forEach((b) => (b.disabled = blocked));
  render();
}
for (const selector of ["#genre-filter", "#genre-input"])
  for (const genre of GENRES) $(selector).add(new Option(genre, genre));
$("#watched-input").max = today();
for (const selector of ["#from-date", "#to-date"]) {
  $(selector).min = "1888-01-01";
  $(selector).max = today();
}
function filters() {
  const range = $("#score-filter").value;
  const [min, max] = range === "all" ? [0, 10] : range.split("-").map(Number);
  return {
    query: $("#search").value,
    genre: $("#genre-filter").value,
    min,
    max,
    from: $("#from-date").value,
    to: $("#to-date").value,
    sort: $("#sort").value,
  };
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function entry(f) {
  const article = el("article", "film-entry");
  const watched = new Date(`${f.watched}T12:00:00`);
  const time = el("time", "watched-date");
  time.dateTime = f.watched;
  time.setAttribute(
    "aria-label",
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(watched),
  );
  time.append(
    el(
      "strong",
      "",
      new Intl.DateTimeFormat("en-GB", { day: "2-digit" }).format(watched),
    ),
    el(
      "span",
      "",
      new Intl.DateTimeFormat("en-GB", {
        month: "short",
        year: "numeric",
      }).format(watched),
    ),
  );
  const body = el("div", "entry-body");
  body.append(
    el("h2", "", f.title),
    el("span", "entry-genre", f.genre),
    el("p", "review", f.review),
  );
  const score = el("div", "entry-score");
  score.setAttribute("aria-label", `Score: ${f.score.toFixed(1)} out of 10`);
  score.append(el("strong", "", f.score.toFixed(1)), el("span", "", "/ 10"));
  article.append(time, body, score);
  if (!demo) {
    const options = el("details", "entry-options");
    const trigger = el("summary", "", "•••");
    trigger.setAttribute("aria-label", `Options for ${f.title}`);
    trigger.dataset.filmId = f.id;
    const menu = el("div", "option-menu");
    const edit = el("button", "", "Edit film"),
      remove = el("button", "", "Remove film");
    edit.setAttribute("aria-label", `Edit ${f.title}`);
    remove.setAttribute("aria-label", `Remove ${f.title}`);
    edit.disabled = blocked || writeBusy;
    remove.disabled = blocked || writeBusy;
    edit.onclick = () => {
      options.open = false;
      openForm(f);
    };
    remove.onclick = () => {
      options.open = false;
      openDelete(f);
    };
    options.append(trigger, menu);
    menu.append(edit, remove);
    article.append(options);
  }
  return article;
}
function render() {
  updateAccountControls();
  const source = demo ? DEMO : films,
    f = filters();
  const visible = filterFilms(source, f);
  $("#total").textContent = source.length;
  $("#average").textContent = source.length
    ? (source.reduce((s, f) => s + f.score, 0) / source.length).toFixed(1)
    : "—";
  $("#month").textContent = source.filter((f) =>
    f.watched.startsWith(today().slice(0, 7)),
  ).length;
  $("#journal-title").textContent = demo ? "Sample diary" : "Watch diary";
  $("#demo-notice").hidden = !demo;
  $("#demo-toggle").textContent = demo
    ? "Back to my diary"
    : "View a sample diary";
  const active = !!(
    f.query ||
    f.genre ||
    f.min !== 0 ||
    f.max !== 10 ||
    f.from ||
    f.to
  );
  $("#clear-filters").hidden = !active;
  const filterCount =
    Number(!!f.genre) +
    Number(f.min !== 0 || f.max !== 10) +
    Number(!!(f.from || f.to));
  $("#filter-label").textContent = filterCount
    ? `Filters (${filterCount})`
    : "Filters";
  $("#date-error").hidden = !(f.from && f.to && f.from > f.to);
  $("#date-error").textContent =
    f.from && f.to && f.from > f.to
      ? "The start date is after the end date."
      : "";
  $("#results").textContent = source.length
    ? `${visible.length} of ${source.length} film${source.length === 1 ? "" : "s"}${demo ? " · Sample data" : ""}`
    : "No films logged yet";
  $("#films").replaceChildren(...visible.map(entry));
  $("#entry-head").hidden = visible.length === 0;
  $("#empty").hidden = source.length > 0 || blocked;
  $("#no-results").hidden = !source.length || visible.length > 0;
}
function reset() {
  $("#search").value = "";
  $("#genre-filter").value = "";
  $("#score-filter").value = "all";
  $("#from-date").value = "";
  $("#to-date").value = "";
  $("#sort").value = "newest";
  render();
}
for (const id of [
  "search",
  "genre-filter",
  "score-filter",
  "sort",
  "from-date",
  "to-date",
])
  $("#" + id).addEventListener("input", render);
$("#clear-filters").onclick = reset;
$("#reset-results").onclick = reset;
$("#filter-toggle").onclick = () => {
  const shown = $("#filters").hidden;
  $("#filters").hidden = !shown;
  $("#filter-toggle").setAttribute("aria-expanded", String(shown));
};
// Native details keeps entry actions keyboard-accessible. Close other action menus.
document.addEventListener("click", (event) => {
  document
    .querySelectorAll(".entry-options[open], #account-menu[open]")
    .forEach((options) => {
      if (!options.contains(event.target)) options.open = false;
    });
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || dialog.open || $("#delete-dialog").open) return;
  document
    .querySelectorAll(".entry-options[open], #account-menu[open]")
    .forEach((options) => {
      options.open = false;
      options.querySelector("summary").focus();
    });
});
function restoreFocus() {
  const trigger = [...document.querySelectorAll(".entry-options summary")].find(
    (node) => node.dataset.filmId === returnFilmId,
  );
  (trigger || document.querySelector(".topbar .add-button")).focus();
}
dialog.addEventListener("close", restoreFocus);
$("#delete-dialog").addEventListener("close", restoreFocus);
function toggleDemo() {
  demo = !demo;
  reset();
}
$("#demo-toggle").onclick = toggleDemo;
$("#leave-demo").onclick = toggleDemo;
function openForm(film = null) {
  if (blocked || writeBusy) return;
  // Refresh before opening; retain the exact snapshot for conflict detection at save.
  load();
  if (blocked) return;
  if (film) {
    film = films.find((f) => f.id === film.id);
    if (!film) {
      announce("This film was removed in another tab.");
      return;
    }
  }
  editing = film?.id ?? null;
  returnFilmId = editing;
  draftRaw = raw;
  draftId = film?.id ?? crypto.randomUUID();
  draftRevision = film?.revision ?? null;
  form.reset();
  $("#form-error").hidden = true;
  $("#form-title").textContent = film ? "Edit your film" : "Log a film";
  $("#title-input").value = film?.title ?? "";
  $("#genre-input").value = film?.genre ?? "";
  $("#watched-input").value = film?.watched ?? today();
  $("#score-input").value = film?.score ?? "";
  $("#review-input").value = film?.review ?? "";
  $("#review-count").textContent = $("#review-input").value.length;
  dialog.showModal();
  $("#title-input").focus();
}
document
  .querySelectorAll(".add-button")
  .forEach((b) => (b.onclick = () => openForm()));
document
  .querySelectorAll("#film-dialog .close")
  .forEach((b) => (b.onclick = () => dialog.close()));
$("#review-input").oninput = () =>
  ($("#review-count").textContent = $("#review-input").value.length);
form.onsubmit = async (event) => {
  if (writeBusy) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  const film = {
    id: draftId,
    title: $("#title-input").value.trim(),
    genre: $("#genre-input").value,
    watched: $("#watched-input").value,
    score: Number($("#score-input").value),
    review: $("#review-input").value.trim(),
  };
  const next = editing
    ? films.map((f) => (f.id === editing ? film : f))
    : [film, ...films];
  const epoch = authEpoch,
    uid = accountUser?.uid;
  setWriteBusy(true);
  try {
    if (uid) {
      if (!accountReady || !navigator.onLine)
        throw new Error("Reconnect before saving. Your draft is still here.");
      await accountService.putFilm(uid, film, draftRevision);
      if (epoch !== authEpoch) return;
    } else {
      raw = save(localStorage, next, draftRaw);
      films = next;
    }
    demo = false;
    reset();
    dialog.close();
    announce(editing ? "Film updated." : "Film saved.");
  } catch (error) {
    if (epoch !== authEpoch) return;
    $("#form-error").textContent =
      `Couldn't save: ${authMessage(error)} Your draft has been kept.`;
    $("#form-error").hidden = false;
  } finally {
    if (epoch === authEpoch) setWriteBusy(false);
  }
};
function openDelete(film) {
  if (blocked || writeBusy) return;
  deleting = film;
  returnFilmId = film.id;
  deleteRaw = raw;
  $("#delete-scope").textContent = accountUser
    ? "This removes the film and review from your account on every device."
    : "This removes the rating and review from this browser.";
  $("#delete-description").textContent =
    `“${film.title}” and your review will be removed.`;
  $("#delete-error").hidden = true;
  $("#delete-dialog").showModal();
  $("#cancel-delete").focus();
}
$("#cancel-delete").onclick = () => $("#delete-dialog").close();
$("#confirm-delete").onclick = async () => {
  if (writeBusy) return;
  const epoch = authEpoch,
    uid = accountUser?.uid;
  setWriteBusy(true);
  const next = films.filter((f) => f.id !== deleting.id);
  try {
    if (uid) {
      if (!accountReady || !navigator.onLine)
        throw new Error("Reconnect before removing this film.");
      await accountService.removeFilm(uid, deleting);
      if (epoch !== authEpoch) return;
    } else {
      raw = save(localStorage, next, deleteRaw);
      films = next;
    }
    $("#delete-dialog").close();
    render();
    announce("Film removed from your journal.");
  } catch (error) {
    if (epoch !== authEpoch) return;
    $("#delete-error").textContent = authMessage(error);
    $("#delete-error").hidden = false;
  } finally {
    if (epoch === authEpoch) setWriteBusy(false);
  }
};
window.addEventListener("storage", (event) => {
  if (!accountUser && (event.key === KEY || event.key === null)) {
    load();
    if (dialog.open) {
      $("#form-error").textContent =
        "Your journal changed in another tab. Your draft is kept here; close and reopen the form before saving.";
      $("#form-error").hidden = false;
    }
    announce("Journal refreshed from another tab.");
  }
});
initializeAccounts();
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {
    /* The journal still works online when offline caching is unavailable. */
  });
