# Agent Memory redesign acceptance record

## Current layout

Memory uses the shared resource PageHeader without a primary action. A typical Agent's single
Context Tree appears as a divided collection row; connecting another tree is a secondary action at
the end of that collection and disappears at the 32-tree limit. The empty state keeps direct
Connect Context Tree and Create Context Tree shortcuts. English consistently uses Context Tree and
Chinese consistently uses 知识树.

Disconnect identifies the exact Context Tree, blocks duplicate submissions, and restores focus to
a surviving collection action. Creation outcomes that are unknown are retained by case-insensitive
repository identity, including when a background config refresh changes the revision before the
response arrives. A confirmed connection clears only the matching unresolved repository.

## Current screenshots

These screenshots were captured on 2026-10-26 from the production App/router/shell fixture and a
production Web build whose rendered UI is based on `1c44c89588ae4628eabc6b0a6878337c3e46d489`.
The capture working tree also contained only the later nonvisual uncertainty-race correction. Account,
Computer, Agent config, and repository data are synthetic; the fixture makes no real repository,
connection, or runtime mutation.

- [English connected, 1440 × 1000](memory-final-en-1440-connected.png) — one Context Tree and the
  in-collection **Connect another Context Tree** action.
- [English empty, 1440 × 1000](memory-final-en-1440-empty.png) — the single-tree-first empty state.
- [Chinese connected, 390 × 1000](memory-final-zh-390-connected.png) — the responsive collection and
  secondary **连接另一棵知识树** action.
- [Chinese empty, 390 × 1000](memory-final-zh-390-empty.png) — responsive empty-state shortcuts.
- [Chinese connect dialog, 320 × 1000](memory-final-connect-zh-320.png) — the narrow repository and
  directory form opened from the collection action.

The pre-revision screenshots, matrix, flow report, and recovery-disclosure report were removed from
the active evidence directory; PR history preserves them without presenting the old header action and
source counter as current behavior.

## Verification

- `pnpm --filter @opentag/web test src/features/agents/agent-settings/context-tree-settings.test.tsx`
  — 30 tests passed, including multiple unresolved identities, matching recovery, config-revision
  uncertainty, operation limits, and focus restoration.
- `pnpm --filter @opentag/web build` passed before capture. Existing browser-externalization and
  chunk-size warnings remain.
- Each capture was inspected at its original viewport. The connected and empty states contain the
  expected localized labels, and the 320px dialog keeps all fields, guidance, and actions in view.

This is focused local visual evidence, not a replacement for full CI, authenticated deployed
acceptance, real GitHub authorization/publication, or exhaustive accessibility testing.

The prior review is [product Issue 1019](https://github.com/first-tree-ai/opentag/issues/1019).
