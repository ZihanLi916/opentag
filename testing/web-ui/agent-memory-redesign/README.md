# Agent Memory redesign acceptance record

## Implemented behavior

Memory reuses the existing resource PageHeader without a primary action and keeps the centered
Soul-style empty composition. Saved Context Trees appear as divided rows inside one collection,
with repository/directory, branch and a direct GitHub link. A trailing secondary action exposes
additional connections without framing the page as an unbounded library. No runtime-ready status
is inferred from a saved connection. English consistently uses Context Tree and Chinese consistently
uses 知识树 across the page and dialogs.

Disconnect confirms the exact Context Tree and preservation impact, initially focuses Cancel, blocks
dismissal/duplicate submissions while pending, retains failures in the confirmation and restores
focus to a surviving neighbour or the empty-state shortcut. Confirmed first connections return focus
to the trailing collection action and retain visible success feedback.

Uncertain creation keeps every attempted repository by case-insensitive identity, blocks unchanged
creation across other attempts, reopening and case-only edits, and offers Open repository / Connect
existing with the matching repository prefilled and focused. A successful connection clears only that
repository's uncertainty. Those recovery actions do not automatically send another request. Longer
repository recovery guidance is secondary disclosure. Directory errors are associated with the field; a
folder-URL example explains the repository-root/directory split without guessing branch names.

Pause and offline restrictions are explained together above the collection. Paused/offline disconnect remains available;
active sources require pause. Cloud exposes only existing-tree connection. Account and restriction
repair links open a new tab so a draft remains in its original tab. Server revision checks,
operation scope guards and preservation of repository/cache/unpublished work remain intact.

Initial read failures retain the Memory heading and offer explicit transient retry. A transient
refresh failure appears below the page title, keeps the form/draft and last selection, visibly marks
the data unconfirmed and disables writes. Terminal authorization/resource failures hide stale settings.

## Local verification

- Component behavior: `pnpm --filter @opentag/web test src/features/agents/agent-settings/context-tree-settings.test.tsx`
  — 27 passed. Covers existing operations and limits plus confirmation, pending/refused disconnect,
  first/last/neighbour focus, multiple uncertain-result identities and targeted recovery, restriction combinations
  and unconfirmed writes.
- Page/query composition: `pnpm --filter @opentag/web test src/__tests__/context-tree-page.test.tsx`
  — 4 passed, including initial retry, draft retention/recovery and terminal refusal.
- `pnpm --filter @opentag/web typecheck` and `pnpm --filter @opentag/web build` passed.
  Existing browser-externalization and chunk-size warnings remain. Local fixture build passed.
- `pnpm check` passed, including the complexity ratchet and Context Tree verification. Existing schema-version/complexity warnings remain; publication-time native gates and CI are separate.

## Browser evidence and limits

The fixture mounts the production App, router, shell, Memory page, Kumo adapter, CSS and translations.
Account, Computer, configuration and operation responses are synthetic; unexpected JavaScript fetches
are rejected. It creates no real repository, connection, schedule or runtime side effect.

- `matrix.json`: English/Chinese × 320/390/768/1440px × empty, connected, active, offline,
  active/offline, Cloud and 32 long-name sources: 56 combinations with no page/main overflow or
  unexpected API request. Connect dialogs fit all eight locale/width combinations after fixing
  a Directory-hint grid overflow. The original narrow-dialog finding and successful rechecks are retained.
- `flows.json`: actual keyboard focus/Tab/Escape, field errors, authentication repair, unknown creation,
  first connection, delayed/confirmed/refused disconnect, and read-retry results. Four scoped WCAG
  A/AA/2.1 AA axe scans found no automatic violations. This does not establish complete accessibility.
- A 200% CSS zoom layout check fits; this is not a native browser-zoom acceptance claim.
  Reduced-motion preference was emulated and the flow remained operable; the shared dialog still
  reports its inherited 150ms transition token, which this feature does not replace.
- Initial setup required building the new checkout's public workspace packages before tests could
  resolve them. Early failures were retained in execution history and not counted as passing results.
- The previous matrix process lost its receipt during a turn interruption. The saved final matrix
  was rerun and inspected; unavailable output is not counted as validation.
- Authenticated deployed acceptance, actual GitHub permissions/publication and runtime memory
  preparation remain separate. The available dev browser previously redirected to sign-in.
  These local results do not establish that CI or deployed acceptance passed.

## Screenshots

- `memory-after-en-1440-{empty,connected,offline-active,cloud}.png`: desktop composition.
- `memory-after-zh-390-{empty,connected,offline-active,cloud}.png`: Chinese mobile composition.
- `memory-connect-zh-320.png`: narrow connect form after the Directory-hint fix.
- `memory-auth-error-en-390.png`, `memory-uncertain-en-390.png`,
  `memory-disconnect-en-390.png`, `memory-read-error-en-390.png`: repair and confirmation surfaces.

The prior review is [product Issue 1019](https://github.com/first-tree-ai/opentag/issues/1019).
This implementation is independent of the Overview Schedule PR and preserves its existing checkout.


## Shared-component contract correction

CI caught the native recovery disclosure through the unchanged Kumo contract. Recovery guidance now uses
the existing shared Collapsible and Button adapters. The combined component, page/query, catalog and Kumo
contract run passes all 45 tests. `recovery-disclosure.json` records eight English/Chinese four-width checks:
Enter/Space expands and collapses the help, expanded content fits, and creation remains locked with exactly
one submitted operation. The updated uncertain-state screenshot and Chinese 320px expanded-help capture
show this final implementation. This local correction still requires new-head CI.
