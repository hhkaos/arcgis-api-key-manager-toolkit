---
name: release
description: Create a new versioned release with changelog, git tag, and GitHub Release
disable-model-invocation: true
---

Follow these steps to create a new release:

## 1. Review unreleased changes

Read `CHANGELOG.md` and show the user all items under `[Unreleased]`. Ask the user to confirm these are the changes they want to include in the release. If the `[Unreleased]` section is empty, stop and inform the user there is nothing to release.

## 2. Suggest version number

Look at the previous version in `CHANGELOG.md` (e.g. `[1.0]`) and analyze the unreleased changes to recommend a version bump:

- **Major** (e.g. `1.0` → `2.0`) — breaking changes, architectural rewrites, or incompatible API changes
- **Minor** (e.g. `1.0` → `1.1`) — new features, enhancements, or non-breaking additions
- **Patch** (e.g. `1.1` → `1.1.1`) — bug fixes only, no new features

Explain the reasoning and let the user confirm or override the suggested version.

## 3. Update project documentation

### CHANGELOG.md

- Rename `## [Unreleased]` to `## [<version>] - <today's date>` (format: `YYYY-MM-DD`)
- Add a new empty `## [Unreleased]` section above it
- Preserve all existing content below

### docs/TODO.md

Read `docs/TODO.md` and update it to reflect the release:

- Mark completed tasks as `[x]`
- Update phase status as needed
- Update checkboxes **in-place** within their existing sections — do NOT append a summary list at the end of the file

### docs/SPEC.md

Read `docs/SPEC.md` and update it if the release includes changes that affect the specification:

- Reflect any architecture, feature, or dependency changes
- Update the version number in the spec header
- Skip if the release is purely internal

### package.json versions

Set the `version` field to the new version in:

- `packages/core/package.json`
- `packages/vscode/package.json`
- `packages/chrome/package.json`

## 4. Regenerate documentation (placeholder)

> **Note:** Documentation generation is not yet set up for this project. When a docs pipeline is added (e.g. TypeDoc), run it here. For now, skip this step.

## 5. Run tests

Run `npm test` from the repo root to ensure everything passes before releasing. If tests fail, stop and inform the user.

## 6. Build assets

Build all packages in dependency order:

```bash
npm run build --workspace=packages/core
npm run build --workspace=packages/vscode
npm run build --workspace=packages/chrome
```

Then package the VS Code extension locally:

- **VS Code extension:** Run `npx vsce package` in `packages/vscode/` to produce the `.vsix` file

> The Chrome extension zip and GitHub Release will be created automatically by the GitHub Actions workflow when the tag is pushed in step 8.

## 7. Stage, commit, and push

Stage the modified files by name:

- `CHANGELOG.md`
- `docs/TODO.md`
- `docs/SPEC.md` (if updated)
- `packages/core/package.json`
- `packages/vscode/package.json`
- `packages/chrome/package.json`

Ask the user which alias to use:

- **`git cai`** — AI-attributed commit (sets author to "AI Generated (hhkaos)" and prefixes the message with "AI: ")
- **`git ch`** — Regular commit with the user's default git identity

Commit with message: `release: v<version>`

Then push with `git push`.

## 8. Create git tag

Run `git tag v<version>` and `git push --tags`.

## 9. Verify GitHub Release

After pushing the tag, the GitHub Actions `release.yml` workflow automatically builds all packages, packages both extensions, and creates the GitHub Release with the assets attached.

Monitor the workflow run with:

```bash
gh run watch
```

Once complete, confirm the release is live:

```bash
gh release view v<version>
```

Show the user the GitHub Release URL.
