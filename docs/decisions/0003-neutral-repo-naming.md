# 0003 — Descriptive repository names without the product name

- **Status:** Superseded by [ai-platform ADR-0001](https://github.com/trungnguyen278/ai-platform/blob/main/docs/decisions/0001-repositories.md) for the repositories' names; its rule against product names stays
- **Date:** 2026-10-15

## Context

- The product has been renamed once (PTalk → Luni) and may be renamed again.
- The last rename was a find-and-replace that broke code: `sounddevice` became `sounddLunice` and `DEVICE_MODEL` became `DLuniCE_MODEL`.
- A bare "robot" is too generic to find; "robot" plus "device" is redundant.

## Decision

- Repositories are named by what they are: `ai-robot` (robot), `ai-robot-server` (backend) and `ai-robot-app` (mobile app), lowercase with hyphens (Docker/GHCR image names must be lowercase).
- The product name (shown on the display, over BLE and in the app) **never** appears in repository, package or identifier names. It lives in **a single configuration file**, created together with the first code.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Product name as a prefix (`Luni_*`) | A product rename forces repository and code renames. |
| Role-only names (`robot-device`, …) | Not memorable and hard to find. |
| A codename | One more name to remember; descriptive names were preferred. |

## Consequences

- Renaming the product later means editing one configuration file.
- GitHub still allows renaming a repository (old links redirect) if it is ever really needed.
