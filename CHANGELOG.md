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

### Changed

- Refreshed explorer UI to a compact, square-corner, Material-inspired visual style across shared components and VS Code webview shell.
- Updated webview and component theming to use VS Code theme tokens (`--vscode-*`) with cross-host fallbacks so UI automatically matches active VS Code theme/profile.

---

## [0.1] - 2026-02-20

### Added

- **Docs:** Functional and technical specification (`docs/SPEC.md`)
- **Docs:** Phased implementation plan (`docs/PLAN.md`)
- **Docs:** Task tracker with checkboxes (`docs/TODO.md`)
- **Tooling:** `CLAUDE.md` project memory file for Claude Code
- **Tooling:** `/ship` skill for committing and pushing changes (`.claude/skills/ship/SKILL.md`)
- **Tooling:** `/release` skill for versioned releases (`.claude/skills/release/SKILL.md`)
