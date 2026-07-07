# Agent Instructions

## Versioning Workflow
This project utilizes semantic versioning (semver). When bumping the version, you MUST ensure that all of the following are synchronously updated:

1. **`package.json`**: Update the `"version"` field to reflect the new semver.
2. **`src/js/welcome.js`**: Update the `console.log` string to strictly match the format `'%cTjenamors vX.X.X! %c🇸🇪'`, replacing `X.X.X` with the requested new version.
3. **Git Tagging**: Create a git commit with the version bump and create an annotated git tag matching the version (e.g. `v1.0.0`). Push the changes and the tags to the remote repository (`git push && git push --tags`).
