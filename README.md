# Frame

A personal film journal for manual entries, ratings from 0–10, short reviews, and filtering by score, genre or date watched. Includes editing, confirmed removal, title search, sorting, statistics, and a separate sample journal. Film-search data is deferred.

**Use the app:** [Open Frame](https://sadaquekhanprojects.github.io/movie-rating-web-app/). No account or installation is needed. [CI/CD runs](https://github.com/SadaqueKhanProjects/movie-rating-web-app/actions/workflows/pages.yml) show validation and deployment status.

## Interface

Frame opens directly into a dark watch diary: dates on the left, reviews in the middle, and scores on the right. Search is always available; genre, score and date filters appear behind **Filters**, with an active-filter count. Each entry’s **•••** button opens Edit and Remove. The short logging form supports keyboard input, returns focus when closed, and keeps confirmation for removal. Small screens put the review below the title so it has room to read.

## Run the system

Prerequisites: Python 3 (tested 3.13.3). Node 24 (tested 24.1.0) and npm are needed only for the checks and command shortcuts. No dependency installation, keys, account, VPN or external service is required.

```sh
git clone https://github.com/SadaqueKhanProjects/movie-rating-web-app.git
cd movie-rating-web-app
npm start
```

Open **http://127.0.0.1:4173**. You should see the empty Frame journal; choose **Log a film** or explore the labelled sample journal. Stop the server with **Ctrl+C** in its terminal.

## Command palette

Run from the checkout root:

| Task | Command | Expected result |
| --- | --- | --- |
| Start | `npm start` | Static local server on port 4173 |
| Start without Node | `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist` | Same server |
| Test | `npm test` | Domain, filter and storage tests pass |
| Syntax check | `npm run check` | JavaScript files parse |
| Stop | Ctrl+C in the server terminal | Server exits |

There is no dependency installation or build step. `dist/` contains the maintained browser source and ready-to-serve assets. The public repository uses GitHub Pages for hosting and GitHub Actions for CI/CD; see [deployment and free-use limits](docs/deployment.md). No paid plan, custom domain, subscription or external deployment secret is required.

## Data and privacy

Entries live in this browser profile's `localStorage`, scoped to this exact origin (scheme, host, port). The hosted site starts with a separate journal from the local preview; existing local entries are not automatically transferred. Use the same address each time: `localhost`, another port, a different browser, and another device each have separate journals. Clearing site data or private-browsing storage can permanently remove entries. There is no cloud sync, encryption layer, export/import or backup in this release. Anyone using this browser profile can read the journal.

The first visit needs the local server. After the app shell has cached successfully, this origin can reload and save entries with the server stopped. Offline availability depends on browser service-worker support and retained site storage; opening the HTML as a `file:` URL is unsupported. Fonts, artwork, scripts and styles are local. The app makes no external requests and has no analytics. The sample journal never gets saved into your entries.

Failed saves keep the form and draft open and leave the last saved journal intact. Unsupported/corrupt stored data is preserved and editing is blocked. Observed changes from another tab refresh the collection; stale open forms cannot overwrite a changed storage snapshot. This is best-effort conflict detection: localStorage has no cross-tab transaction, so avoid simultaneous submissions in multiple tabs. See [architecture and recovery](docs/architecture.md).

## Architecture

```mermaid
flowchart LR
  User[Film form and filters] --> UI[app.js: DOM and interaction]
  UI --> Core[core.js: validation and filtering]
  Core --> Store[Browser localStorage: journal v1]
  UI --> SW[sw.js: local app-shell cache]
```

`index.html` and `styles.css` provide responsive, keyboard-accessible presentation. `core.js` owns validation, storage serialization and filter rules. `app.js` renders text through DOM text nodes, without interpreting titles or reviews as HTML. Film-search integration can later map search results to the same validated form for user review; it must not overwrite manually entered data.

## Verification

See [validation evidence and limits](docs/validation.md). All nine domain/storage tests and JavaScript syntax checks pass. The redesigned UI was checked in the in-app browser at desktop and narrow widths, including combined filters, creating/editing, reload persistence, action menus, keyboard Escape/focus return, and removal confirmation/cancellation. The original offline workflow was checked in Chrome. The original release and redesign evidence is retained there; current CI/CD status is available through the workflow link above. No physical-device test is claimed.


## Contributing and deployment

Create an issue, branch as `feature/<issue-number>-<description>` (or another appropriate type), and use scoped Conventional Commits. Run the local checks, then open a PR to `main`. The `Validate` check must pass before merging. Merges to `main` run validation again and deploy only the checked `dist/` artifact. PRs never deploy. See [deployment](docs/deployment.md) for rollback, cost constraints and settings; enforcement depends on the repository's configured branch rules.
