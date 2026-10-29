# Validation evidence — 28 October 2026

## Initial release

Environment: macOS, Node 24.1.0, Python 3.13.3, Chrome desktop. All entries used for acceptance checks were synthetic and removed afterwards.

- `npm test`: 9 passing tests covering create/reload/edit/delete serialization; 0/10 boundaries and invalid scores; title/review/genre/date rules; corruption, unsupported schemas and duplicate IDs; failed write preservation; intervening storage changes; combined inclusive filtering and sorting; access-denied reads; literal untrusted text.
- `npm run check`: app, core and service worker syntax checks passed.
- HTTP preview: port 4173 returned 200 and loaded the app.
- Chrome UI: empty state, create an 8.5/10 Drama entry, reload persistence, edit to 0/10, score and genre no-results states, date exclusion, filter reset and confirmed deletion all exercised.
- Offline: stopped the actual local server, reloaded the cached app, created a 10/10 synthetic entry, reloaded it successfully, and removed it while the server remained stopped. Server was restarted after the check.
- Visual inspection: desktop sample cards and controls; empty journal and controls inside a 390px-wide iframe. No physical phone was used.
- Samples: labelled separate from the user's collection; reloading returns to the user's journal.

Limits: storage failures/corruption/conflicts are covered at the domain boundary using storage doubles, not injected into the real browser profile. Two tabs submitting at exactly the same time are not transactionally coordinated. No dedicated screen-reader, physical-device, full accessibility audit or browser matrix. Offline first visit cannot work before the assets are cached. No external film search, server, backups, accounts, hosted deployment or remote CI was introduced.

No subscriptions, APIs, third-party dependencies or hosting were added. GitHub private repository delivery uses existing authentication. Private GitHub Actions workflows were deliberately omitted because an effective hard overage spending block could not be verified; local validation supports the PR. This is not a claim about the user's account-wide bill or shared allowance.

Source formatting used Prettier 3.6.2 from the npm registry in an isolated temporary cache, with no package added to the app.


## Diary redesign — issue #3

- Existing nine tests and syntax checks pass before and after the redesign. The storage key, schema, validation and filter domain rules are unchanged.
- In-app browser: created a synthetic 8.5 Drama entry, edited it through the entry options to 0, and confirmed the saved result after reload.
- Combined sample filters: Sci-Fi + 9–10 + watched from/through 18 September returned only Interstellar. Clear filters restored the collection.
- Keyboard: Enter opened entry actions; Escape closed them. Cancelling removal preserved the entry and returned focus to its options button. Saving a new entry returned focus to Log a film. The synthetic entry was removed through confirmation after verification.
- Visual checks: diary at the normal 755 CSS-pixel viewport and narrow 433 CSS-pixel viewport (the browser's measured inner width after its viewport override). Narrow filters and the logging dialog remained usable; document width matched the viewport without horizontal overflow. This is desktop browser layout evidence, not a physical-device test or accessibility audit.
- The service-worker cache version was advanced for the redesigned shell. The browser loaded the updated interface without clearing localStorage. No new dependencies, remote workflows or deployment were introduced.

Interaction choices: put the diary first; use consistent date/film/score columns for scanning; reveal secondary filters and entry actions on demand; keep field labels visible; make action targets at least 44px; provide visible keyboard focus, Escape behavior and logical focus restoration; preserve confirmation for destructive removal. These are design decisions validated by the interactions above, not a user research study.


## Private accounts — implementation branch, 29 October 2026

- Seventeen unit/domain/storage/build-boundary tests pass. Local Firebase integration uses Auth + Firestore emulators with only `demo-frame` resources: anonymous/unverified denial, owner CRUD, cross-user read/write/delete denial, invalid direct writes, stale revisions, atomic repeatable imports, sign-out/sign-in and reset requests. Independent-session sync is also covered.
- Browser preview on a fresh localhost origin verified synthetic signup, unverified-account blocking, email action verification through the local emulator, explicit import naming the account, reload persistence, sign-out, a second isolated diary, and private-record clearing between users. Original guest films remained in the browser. No real email was sent.
- Production Firebase login, provider quotas/plan, live rules and real email delivery are not yet verified because Firebase requires owner sign-in/setup. The account branch must remain undeployed until that setup is complete.
- Runtime dependency audit is clear after the scoped gRPC override; five moderate CLI-only development advisories remain and are documented in accounts.md. No global runtime or permissions were modified.
