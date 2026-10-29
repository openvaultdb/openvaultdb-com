---
format: https://specscore.md/feature-specification
status: Draft
---

# Feature: Localized Landing

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/localized-landing?op=explore) | [Edit](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/localized-landing?op=edit) | [Ask question](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/localized-landing?op=ask) | [Request change](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/localized-landing?op=request-change) |
**Status:** Draft
**Source Ideas:** —

## Summary

The public landing page is published in English and Russian with identical claims: a language switch, reciprocal hreflang, a per-locale click-to-load film slot, and no claim of encryption (access is controlled by scoped, revocable tokens and grants).

## Problem

The landing page reached only English readers, and it advertised row-level
encryption that the OpenVaultDB MVP does not have (the MVP does not encrypt vault
data; access is controlled by grants). Russian-speaking developers need the same
page in their language, and no page may claim a protection the product lacks.

## Behavior

### Content accuracy

#### REQ: no-encryption-claim

No page MAY claim that vault data is encrypted, row-level or otherwise. Pages MUST
describe access control as scoped, revocable tokens and grants, and MAY state that
the MVP does not encrypt vault data.

### Locales

#### REQ: russian-landing

The landing page MUST be available in Russian at `/ru`, with `<html lang="ru">`,
its own canonical URL and Open Graph locale, making exactly the same claims as the
English page (never stronger). The privacy notice MUST have a Russian counterpart
at `/ru/privacy`. Product names, code, commands and CLI output stay as they are.

#### REQ: locale-discovery

Each localized page MUST link to its counterpart with a visible language switch
and reciprocal `hreflang` annotations (`en`, `ru`, `x-default` = English), and both
URLs MUST be listed in the sitemap with the same alternates.

### Film slot

#### REQ: click-to-load-film

The landing page MUST contain a film slot that stays hidden until the single flag
in `public/js/video-config.js` is enabled and the page language has a video id.
When shown it MUST display a local poster with explicit dimensions and MUST NOT
contact YouTube until the visitor clicks, then load the player from
`youtube-nocookie.com`.

## Acceptance Criteria

### AC: no-encryption-claim-on-landing (verifies REQ:no-encryption-claim)

**Given** the English and Russian landing pages
**When** their text is searched for encryption claims
**Then** only the explicit statement that the MVP does not encrypt vault data appears (`test/locale.test.mjs`).

### AC: russian-landing-renders (verifies REQ:russian-landing)

**Given** a visitor opens `/ru`
**When** the page loads
**Then** it renders in Russian with lang `ru`, canonical `/ru`, and the same sections and links as the English page (`test/locale.test.mjs`, `e2e-analytics/locale.spec.ts`).

### AC: languages-link-both-ways (verifies REQ:locale-discovery)

**Given** the English and Russian pages
**When** a visitor uses the language switch on either
**Then** they land on the other locale, and hreflang and sitemap alternates are reciprocal (`e2e-analytics/locale.spec.ts`).

### AC: film-needs-a-click (verifies REQ:click-to-load-film)

**Given** the film flag is enabled with a video id for the locale
**When** the page loads, and later the visitor clicks the poster
**Then** no YouTube request is made before the click, and afterwards the player loads from `youtube-nocookie.com` (`e2e-analytics/locale.spec.ts`).

## Open Questions

None at this time.

---
*This document follows the https://specscore.md/feature-specification*
