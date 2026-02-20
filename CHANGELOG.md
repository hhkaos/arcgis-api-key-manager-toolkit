# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

- Monorepo workspace implementation for `packages/core`, `packages/vscode`, and `packages/chrome` with strict TypeScript, build scripts, and test wiring.
- Shared core domain layer: environment management, ArcGIS REST client wrappers, filtering/sorting/expiration logic, and host/webview messaging protocol.
- Shared Lit component set for configuration, sign-in, credential list/detail, expiration badges, and key create/regenerate modal flows.
- VS Code extension implementation including TreeView commands, adapters (storage/auth/clipboard), webview bridge, and credential/key action flows.
- Contributor/agent docs and development support files (`README.md`, `CONTRIBUTING.md`, `AGENTS.md`, eslint/prettier/workspace config).
- Chrome extension baseline implementation (MV3 manifest, popup launcher, explorer tab UI, service worker, Chrome storage/auth/clipboard adapters, and build pipeline).
- Chrome OAuth local-development setup docs for unpacked extensions and `chromiumapp.org` redirect URL configuration.
- Chrome popup state unit tests for auth control visibility, enterprise field visibility, and post-sign-in explorer auto-open decision logic.

### Changed

- Refreshed explorer UI to a compact, square-corner, Material-inspired visual style across shared components and VS Code webview shell.
- Updated webview and component theming to use VS Code theme tokens (`--vscode-*`) with cross-host fallbacks so UI automatically matches active VS Code theme/profile.
- Core package exports now separate runtime modules from component registration (`@arcgis-api-keys/core/components`) to keep service worker bundles DOM-free.

### Fixed

- Chrome popup now correctly hides the Enterprise portal URL field for non-Enterprise environment types.
- Chrome popup auth controls now reflect selected environment sign-in state (`Sign In` vs `Sign Out` / `Open Explorer`).
- Explorer tab now opens automatically after successful Chrome sign-in, and environment add/save works reliably by avoiding DOM imports in the service worker.

---

## [0.1] - 2026-02-20

### Added

- **Docs:** Functional and technical specification (`docs/SPEC.md`)
- **Docs:** Phased implementation plan (`docs/PLAN.md`)
- **Docs:** Task tracker with checkboxes (`docs/TODO.md`)
- **Tooling:** `CLAUDE.md` project memory file for Claude Code
- **Tooling:** `/ship` skill for committing and pushing changes (`.claude/skills/ship/SKILL.md`)
- **Tooling:** `/release` skill for versioned releases (`.claude/skills/release/SKILL.md`)
