# Hosting and CI/CD

Production: https://sadaquekhanprojects.github.io/movie-rating-web-app/

The owner authorized public repository visibility and GitHub Pages hosting on 29 October 2026. The source and commit history are public. Film entries stay in each visitor's browser; the workflow publishes static app files, not journal records. The hosted origin is different from localhost, so an existing local journal does not transfer automatically. No account, backend, subscription, custom domain or new deployment secret was added.

## Pipeline

`.github/workflows/pages.yml` runs on PRs targeting `main`, pushes to `main`, and manual dispatch. `Validate` uses Node 24 to run `npm run check` and `npm test`; there is no dependency installation or build. On `main`, it uploads only `dist/` as a Pages artifact with one-day retention. The deployment job depends on successful validation and deploys that same artifact through GitHub's `github-pages` environment. A PR cannot deploy, and a manual run on another branch cannot deploy. Failed validation leaves the last successful production deployment in place.

The workflow uses standard `ubuntu-24.04` runners, SHA-pinned official actions, no package cache, a read-only validation token and only Pages/OIDC write permissions for deployment. Both jobs skip when the event reports the repository as private. This guard helps prevent running these jobs under private-repository billing; it is not an account-wide spending limit and cannot protect a future edited workflow or another repository.

GitHub Pages must remain configured with **GitHub Actions** as its publishing source. Production deployment is restricted to `main` through the `github-pages` environment. The repository's required `Validate` check is intended to gate merges; verify the actual branch protection settings rather than assuming a workflow alone enforces merging rules.

## Free-only scope

Verified against GitHub documentation on 29 October 2026:

- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) is available for public repositories on GitHub Free. A paid account upgrade is not needed for this configuration.
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) states that standard hosted runners in public repositories are free. This workflow uses those runners; it does not use larger or private runners, paid APIs, Codespaces or external hosting. Public repository visibility was verified before enabling the workflow. No account-wide billing setting or paid plan was changed.
- [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) include a 1 GB published-site limit, a soft 100 GB/month bandwidth limit and possible rate limiting. Excess usage may cause interruption or a request to reduce usage/move hosting. This setup does not provision billable overage infrastructure. The custom Actions workflow is not subject to the branch-build limit of 10 builds/hour.
- Only the small static site is uploaded, with one-day artifact retention and no Actions package cache. Do not add paid features or change to private CI under the assumption that an included allowance guarantees no charges. This documents this project's setup, not the account's overall bill.

## Updating and rollback

1. Create an issue and a focused branch, make changes and run `npm test` plus `npm run check`.
2. For any `dist/` change, advance the shell cache version in `dist/sw.js`. Existing tabs retain the old worker until they close; close all Frame tabs and reopen to use an installed update. Never clear localStorage just to update the app.
3. Push the branch and open a PR. Wait for `Validate` on the exact PR head and resolve failures before merging.
4. Merge to `main`; monitor the workflow's validation and deployment jobs. A successful merge is not deployment proof. Check the returned Pages URL and the actual app after deployment.
5. For rollback, revert the faulty change through a PR and use a new cache version. Merging the revert runs the same validation and deployment process. Re-running a previously successful workflow can redeploy its old revision, so use it only for an intentional rollback.

If a Pages artifact has expired, a manual run from `main` creates a fresh one. A hosting outage does not delete journal records: the cached app can continue offline after a successful first load, subject to browser support and retained storage. Records have no cloud sync or backup.
