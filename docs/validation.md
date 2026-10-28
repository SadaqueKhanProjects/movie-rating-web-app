# Validation evidence — 28 October 2026

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
