import { KEY, GENRES, DEMO, today, read, save, filterFilms } from "./core.js";
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
function announce(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 4000);
}
function load() {
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
    edit.disabled = blocked;
    remove.disabled = blocked;
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
  document.querySelectorAll(".entry-options[open]").forEach((options) => {
    if (!options.contains(event.target)) options.open = false;
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || dialog.open || $("#delete-dialog").open) return;
  document.querySelectorAll(".entry-options[open]").forEach((options) => {
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
  if (blocked) return;
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
form.onsubmit = (event) => {
  event.preventDefault();
  const film = {
    id: editing ?? crypto.randomUUID(),
    title: $("#title-input").value.trim(),
    genre: $("#genre-input").value,
    watched: $("#watched-input").value,
    score: Number($("#score-input").value),
    review: $("#review-input").value.trim(),
  };
  const next = editing
    ? films.map((f) => (f.id === editing ? film : f))
    : [film, ...films];
  try {
    raw = save(localStorage, next, draftRaw);
    films = next;
    demo = false;
    reset();
    dialog.close();
    announce(editing ? "Film updated." : "Film saved.");
  } catch (error) {
    $("#form-error").textContent =
      `Couldn't save: ${error.message} Your draft has been kept. Check browser storage permissions or available space if needed.`;
    $("#form-error").hidden = false;
  }
};
function openDelete(film) {
  deleting = film;
  returnFilmId = film.id;
  deleteRaw = raw;
  $("#delete-description").textContent =
    `“${film.title}” and your review will be removed.`;
  $("#delete-error").hidden = true;
  $("#delete-dialog").showModal();
  $("#cancel-delete").focus();
}
$("#cancel-delete").onclick = () => $("#delete-dialog").close();
$("#confirm-delete").onclick = () => {
  const next = films.filter((f) => f.id !== deleting.id);
  try {
    raw = save(localStorage, next, deleteRaw);
    films = next;
    $("#delete-dialog").close();
    render();
    announce("Film removed from your journal.");
  } catch (error) {
    $("#delete-error").textContent = error.message;
    $("#delete-error").hidden = false;
  }
};
window.addEventListener("storage", (event) => {
  if (event.key === KEY || event.key === null) {
    load();
    if (dialog.open) {
      $("#form-error").textContent =
        "Your journal changed in another tab. Your draft is kept here; close and reopen the form before saving.";
      $("#form-error").hidden = false;
    }
    announce("Journal refreshed from another tab.");
  }
});
load();
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {
    /* The journal still works online when offline caching is unavailable. */
  });
