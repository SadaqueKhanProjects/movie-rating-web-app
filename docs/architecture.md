# Data contract and maintenance

The journal key is `frame.journal.v1`; its value is `{ "version": 1, "films": [...] }`. Each film has a unique string `id`, nonempty `title` (maximum 120 characters), one supported `genre`, numeric `score` (0–10 inclusive, at most one decimal), local calendar `watched` date (1888 through today), and nonempty `review` (maximum 600 characters). IDs remain stable across edits. Dates are stored as ISO calendar strings and formatted without converting them to a different day.

Read validates the whole document before use. Writes validate all records and compare the current storage string against the editing snapshot before `setItem`. UI state changes only after a successful write. A failed write retains the draft and previous saved state. Deletion requires the in-app confirmation. Demo records are a read-only view separate from storage.

Concurrent-tab protection is best effort, not a database transaction. A storage event refreshes the collection and warns an open editor. A stale snapshot is rejected on submit. There remains a narrow race between comparison and `setItem`; use one editing tab at a time. Move to transactional IndexedDB or a coordinated write lock before promising fully concurrent editing.

For a schema change, implement and test an explicit migration before changing the version. Never clear storage on parse or validation errors. Recovery currently requires a technically knowledgeable user to inspect/copy the existing key in browser developer tools and restore valid version-1 JSON; there is no in-app restore. Preserve a copy before making manual repairs. Clearing site data is destructive and is not a repair workflow.

All assets are authored here; no poster, font, library or film metadata service is bundled. Maintain source directly in `dist/`. There are no third-party runtime dependencies or generated bundles, so no dependency lockfile is necessary. Node's built-in test runner covers the pure model using isolated storage doubles; it does not prove a browser's quota behavior.

The service worker precaches a versioned shell. Increment its `CACHE` name whenever shell assets change. A newly installed worker activates after old app tabs close; reopen the page to use the new version. Old Frame shell caches are removed on activation. User journal data is in localStorage, separate from these caches. Do not casually change origin or storage keys. Production serves these same relative assets under the GitHub Pages project path; no root-path rewrite or build is needed.

Manual review before merging: run `npm test` and `npm run check`, inspect the diff for secrets or unrelated files, then exercise the main workflow. Prefer issue-numbered feature branches and scoped Conventional Commits. CI now uses standard runners only while the repository is public. Do not introduce metered private CI, larger runners or other paid services without separate authorization and verified spending protection. See deployment.md.
