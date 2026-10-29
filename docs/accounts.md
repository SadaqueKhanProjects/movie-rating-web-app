# Private accounts and synced diaries

## Current rollout boundary

This branch implements Firebase email/password accounts and per-user Firestore diaries. It has been tested against local demo emulators. A live Firebase project, its no-cost Spark plan, email provider, authorized domains and deployed database rules still need to be configured and verified before this branch is merged or deployed. The existing public site remains unchanged until then. Connecting the Firebase plugin is one option; the owner can also sign in to the Firebase console to configure the project.

## Behavior and data

- Guests retain the original `frame.journal.v1` browser journal. Signing in does not upload or delete it. An explicit import dialog names the destination account and keeps browser originals. Import merges by stable film ID, skips identical records, rejects conflicts atomically and supports browser journals of up to 200 films. Larger journals require a future batch-import flow; they are preserved rather than partially imported.
- Accounts support signup, sign-in, sign-out, verification email/resend, checking verification, and password-reset requests. The app requires at least 12 password characters on signup; set the same minimum in Firebase's server-side password policy.
- Firebase handles passwords; application code does not log or store them. The Firebase SDK uses browser session persistence for authentication. A tab reload keeps the session; closing the session may require signing in again. The browser/password manager may offer separate credential storage under the user's control.
- Only verified accounts can use the cloud diary. Each film is `/users/{uid}/films/{id}` and database rules enforce the authenticated owner's UID plus verified email, allowed fields, sizes, score range, genre and revisions. The client also validates actual calendar dates and future dates; the server rules validate date-string shape. These are separate validation boundaries.
- Each mutation uses a Firestore transaction with an expected revision. A stale edit/delete is rejected and the draft is kept. Another session's updates arrive through a listener. Import validates all conflicts before any write.
- Private films use Firestore's in-memory cache, not persistent browser storage. The application clears its records and drafts on auth changes and ignores callbacks from older sessions. Signing out returns to the separate guest journal; those original guest records remain accessible in that browser profile. The Firebase SDK may retain transient internal memory until the page closes.
- Cloud saves/imports/deletion require a connection. Account films can remain visible read-only during a temporary network interruption, but a fresh signed-in page waits for a server snapshot before showing records. This avoids presenting a stale cache as a successful empty sync. No offline write queue is promised. Existing guest storage remains available offline after the shell is cached.
- Account identity and private film data are sent to Firebase/Google for authentication/storage. Other users cannot read them through the database rules. There is no public sharing, analytics integration, cloud backup/export, or account deletion UI in this release. Account removal can be handled by the owner in Firebase; deleting an Auth user alone does not automatically remove Firestore documents.

## Configure the live project — no paid plan

1. In https://console.firebase.google.com/, create or select a dedicated project. Keep **Spark** with no billing account linked; do not select Blaze, attach billing, enable phone authentication, Cloud Functions or paid add-ons. Check the actual project's plan before enabling production. No billing setting has been configured or verified by this branch yet.
2. Register a Web app. Copy only its public web configuration into a local ignored `.firebase-web.json`, using `config/firebase-web.example.json` as the shape. Alternatively provide the JSON as `FRAME_FIREBASE_CONFIG` when building. These public fields identify the project; they do not authorize private data access. Never supply service-account JSON, an admin credential, private key or user token.
3. Enable **Authentication → Email/Password**, configure the server password policy (minimum 12 characters), enable email enumeration protection, and review verification/reset email templates. Add `sadaquekhanprojects.github.io` as an authorized domain. Add localhost only for intentional local testing with that live project; emulator testing needs no live provider.
4. Create the default Cloud Firestore **Standard edition** database, choosing the intended region before creation (for a UK-oriented project, consider London where available). Start with denied access; never use open test rules. Publish exactly `firestore.rules` through the console or an authorized local CLI: `npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`. This command changes the live rules and has not been run yet. It must target the selected Spark project, never an unrelated existing project.
5. Put the same public configuration JSON in this repository's Actions variable **FRAME_FIREBASE_CONFIG**. The Pages pipeline builds it into `dist/account-config.js`. No deployment token is needed in the repository. Database-rule deployment is separate from Pages; review rule changes and deploy them before the corresponding application release.
6. Run local checks and emulator integration tests. Then verify real signup, email delivery, password reset, two separate accounts and a second device/session against the live project. Inspect deployed rules and Spark billing state. Keep the PR draft until these required live checks and configuration are complete.
7. Merge only after CI passes for the exact head. The main-branch build requires a non-demo Firebase configuration before it can publish; missing configuration stops deployment and preserves the existing site. A configuration object alone is not proof that the backend is secure or operational.

Firebase's [Spark plan](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) has no payment requirement and blocks/limits usage at its quotas rather than provisioning paid overage. Authentication email/rate and [Firestore](https://firebase.google.com/docs/firestore/quotas) quotas still apply; verify current limits for the chosen project. Do not upgrade or attach billing to avoid an interruption under the free-only requirement.

## Local development and tests

Use Node 24.12 or newer within major 24 (tested 24.22.2; `.nvmrc` pins that version). Java 21 is needed only for the emulators. No global installation of Firebase tooling is required.

```sh
npm ci
npm run build                  # public config if supplied; otherwise guest-only setup
npm test                       # unit/domain/storage checks
npm run check
npm run test:integration        # local Auth + Firestore emulators, demo-frame project only
```

For the full local account preview:

```sh
npm run build:emulators
npm run emulators              # keep running in terminal 1
npm start                      # terminal 2: open http://localhost:4173
```

These commands use synthetic local accounts; no real email is sent. Verification/reset links are available in the emulator output. Stop both processes with Ctrl+C. `npm run build:emulators` must not be used for production. Run `npm run build` again before preparing a real release. Generated files in `dist/vendor/` and `dist/account-config.js` are ignored and rebuilt by CI. The service worker caches the app shell and bundled code only; Firebase requests are cross-origin and excluded.

On restricted macOS environments, run npm with an isolated cache if the global cache is unwritable. Firebase CLI can use `NO_UPDATE_NOTIFIER=1`, `XDG_CONFIG_HOME=/private/tmp/frame-firebase-config` and `FIREBASE_EMULATORS_PATH=/private/tmp/frame-emulators` for task-local configuration/downloads. Do not change global file ownership to run tests. CI sets the emulator download path to the runner's temporary directory.

## Dependencies and checks

Firebase SDK 13.1.0 is Apache-2.0; the build includes its full license plus esbuild's preserved dependency notices. Only App/Auth/Firestore browser modules are bundled (about 560 KiB uncompressed at initial verification). Source is maintained in `src/firebase-client.js`, with generated `dist/vendor/accounts.js`; the build is the only generation path. Rebuild and recheck when upgrading the SDK, lockfile or account client.

A narrow override replaces Firestore's Node-only `@grpc/grpc-js` dependency with 1.14.7; emulator tests exercise it. `npm audit --omit=dev` reports no vulnerabilities after that override. At implementation time, full audit still reports five moderate development-tool advisories via Firebase CLI's `@opentelemetry/core`/`uuid` dependency chains. These CLI modules are not bundled into the browser; no forced major downgrade/override was used to silence the advisories. Recheck upstream CLI updates before live administration. This is not a security audit or a claim that the browser app is vulnerability-free.
