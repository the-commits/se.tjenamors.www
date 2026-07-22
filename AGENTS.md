# Agent Instructions

## Versioning Workflow
This project utilizes semantic versioning (semver). When bumping the version, you MUST ensure that all of the following are synchronously updated:

1. **`package.json`**: Update the `"version"` field to reflect the new semver.
2. **`src/js/welcome.js`**: Update the `console.log` string to strictly match the format `'%cTjenamors vX.X.X! %c🇸🇪'`, replacing `X.X.X` with the requested new version.
3. **Git Tagging**: Create a git commit with the version bump and create an annotated git tag matching the version (e.g. `v1.0.0`). Push the changes and the tags to the remote repository (`git push && git push --tags`).

## Theme Refactoring
When instructed to change the color scheme or theme of a project (e.g., Synthwave to Black & White), you MUST:
1. **Analyze existing shapes:** Carefully review the existing CSS for complex shapes built using gradients, `clip-path`, or precise mathematical stops (e.g., a striped synthwave sun with progressively widening gaps).
2. **Retain structural logic:** When recoloring these elements, keep the exact positional logic (e.g., percentage stops, transparent gaps) intact. Do not replace them with simplified or generic shapes unless explicitly asked to do so.
3. **Map colors carefully:** Map the old theme's colors to the new theme's palette, but maintain all `transparent` cutouts or masking effects that define the element's silhouette.

## Verify CSP via Browser DevTools
When implementing or modifying a Content Security Policy (CSP), you MUST:
1. **Never rely solely on static analysis**: Dynamically injected scripts, third-party SDKs, and Web Workers (e.g., `blob:` URLs) are easily missed when just reading the source code.
2. **Verify via MCP**: Use the `firefox-devtools` MCP server (specifically `navigate_page` followed by `list_console_messages`) to actively check the browser console for CSP violation errors.
3. **Patch dynamically**: Ensure you allow necessary `worker-src`, `connect-src`, and `script-src` directives for dependencies that only appear during runtime execution before finalizing the CSP.
