## Change

Describe the problem and resulting behavior. Link the issue (`Closes #...`).

## Validation

Record checks actually run, relevant browser evidence and limitations. Wait for `Validate` on the current head before merging.

## Deployment impact

If `dist/` changes, advance the service-worker cache version. Merging to `main` deploys the validated static site. Confirm no journal data, credentials or unrelated files are included, and preserve the public/free-only standard-runner configuration.
