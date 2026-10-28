export const KEY = "frame.journal.v1";
export const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Fantasy",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "Other",
];
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function validDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) >= 1888 &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function validate(film) {
  if (
    !film ||
    typeof film !== "object" ||
    typeof film.id !== "string" ||
    !film.id ||
    typeof film.title !== "string" ||
    !film.title.trim() ||
    film.title.length > 120
  )
    throw new Error("Enter a film title (up to 120 characters).");
  if (!GENRES.includes(film.genre)) throw new Error("Choose a genre.");
  if (
    typeof film.score !== "number" ||
    !Number.isFinite(film.score) ||
    film.score < 0 ||
    film.score > 10 ||
    !Number.isInteger(film.score * 10)
  )
    throw new Error(
      "Use a score from 0 to 10, with at most one decimal place.",
    );
  if (!validDate(film.watched) || film.watched > today())
    throw new Error("Choose a valid date watched, from 1888 through today.");
  if (
    typeof film.review !== "string" ||
    !film.review.trim() ||
    film.review.length > 600
  )
    throw new Error("Write a short review (up to 600 characters).");
  return film;
}
export function decode(raw) {
  if (raw === null) return [];
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      "Saved data could not be read. It has been preserved; restore it in browser storage before editing.",
    );
  }
  if (data?.version !== 1 || !Array.isArray(data.films))
    throw new Error(
      "This saved journal has an unsupported format. It has been preserved.",
    );
  data.films.forEach(validate);
  if (new Set(data.films.map((f) => f.id)).size !== data.films.length)
    throw new Error(
      "Saved data contains duplicate IDs. It has been preserved.",
    );
  return data.films;
}
export function read(storage) {
  const raw = storage.getItem(KEY);
  return { raw, films: decode(raw) };
}
export function save(storage, films, expectedRaw) {
  films.forEach(validate);
  if (new Set(films.map((f) => f.id)).size !== films.length)
    throw new Error("Duplicate film IDs cannot be saved.");
  // Check immediately before writing so another tab's observed changes are not overwritten.
  if (storage.getItem(KEY) !== expectedRaw)
    throw new Error(
      "Your journal changed in another tab. Close this form and reopen it to use the latest version. Your draft is still here.",
    );
  const raw = JSON.stringify({ version: 1, films });
  storage.setItem(KEY, raw);
  return raw;
}
export function filterFilms(
  films,
  {
    query = "",
    genre = "",
    min = 0,
    max = 10,
    from = "",
    to = "",
    sort = "newest",
  } = {},
) {
  const result = films.filter(
    (f) =>
      f.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
      (!genre || f.genre === genre) &&
      f.score >= Number(min) &&
      f.score <= Number(max) &&
      (!from || f.watched >= from) &&
      (!to || f.watched <= to),
  );
  return result.sort((a, b) =>
    sort === "highest"
      ? b.score - a.score || b.watched.localeCompare(a.watched)
      : sort === "lowest"
        ? a.score - b.score || b.watched.localeCompare(a.watched)
        : sort === "title"
          ? a.title.localeCompare(b.title)
          : sort === "oldest"
            ? a.watched.localeCompare(b.watched)
            : b.watched.localeCompare(a.watched),
  );
}
export const DEMO = [
  {
    id: "demo-1",
    title: "The Grand Budapest Hotel",
    genre: "Comedy",
    score: 9.2,
    watched: "2026-09-22",
    review:
      "A tiny, beautiful world I could spend hours in. Every frame feels like a postcard, and the warmth underneath it all stayed with me.",
  },
  {
    id: "demo-2",
    title: "Interstellar",
    genre: "Sci-Fi",
    score: 9.5,
    watched: "2026-09-18",
    review:
      "Came for the galaxies. Stayed for the quiet, human story at the centre of it. That score still gives me chills.",
  },
  {
    id: "demo-3",
    title: "Past Lives",
    genre: "Romance",
    score: 8.8,
    watched: "2026-09-12",
    review:
      "So much said in the spaces between words. A gentle reminder that some people stay with you, even when life takes you elsewhere.",
  },
  {
    id: "demo-4",
    title: "Spirited Away",
    genre: "Animation",
    score: 9.4,
    watched: "2026-09-08",
    review:
      "Strange, generous and full of wonder. The train ride across the water is a little piece of magic.",
  },
];
