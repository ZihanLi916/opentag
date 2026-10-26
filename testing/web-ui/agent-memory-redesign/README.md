# Memory single-tree journey acceptance

## Current behavior

The shared PageHeader has no Add action or capacity counter. The centered empty state offers Connect
Context Tree and Local-only Create Context Tree. A saved Context Tree shows its repository/directory,
branch and GitHub link. A quiet trailing Connect another Context Tree row sits inside the collection;
it is hidden at the existing limit. Cloud opens Connect directly. This is a saved selection, never a
runtime-ready claim.

Disconnect confirms the exact tree and preservation impact, starts on Cancel, blocks duplicate writes
and pending dismissal, retains failures and returns focus to a surviving row or the empty shortcut.
First connection focuses the trailing action. Reaching the limit returns to a surviving row rather
than the hidden action. Revision checks and Agent/mount boundaries remain intact.

Unresolved creates are retained independently by case-insensitive repository identity. A→B→A stays
locked, reopening preserves the lock, and only a confirmed matching connection clears it. A late
publication_uncertain response still records its lock after a config revision refresh, while stale
success and old-Agent responses remain ignored. Recovery prefills and focuses the repository input;
it never automatically writes. Expanded guidance uses shared Collapsible and Button.

Transient refresh errors appear below the page title, preserve drafts and disable unconfirmed writes.
Terminal authorization/resource errors hide stale settings. Pause/offline repair links retain drafts
in the original tab. The English Context Tree / Chinese 知识树 terminology is consistent.

## Verification

- 50 focused Memory component/page/catalog/Kumo tests passed, including the current remote limit/focus
  cases and the late-uncertainty regression. Web typecheck, production build and fixture build passed.
- `single-tree-matrix.json`:56 en/zh ×320/390/768/1440 state layouts (empty,connected,active,offline,
  active/offline,Cloud,32 long-name trees) and8 connect dialogs fit without document/main overflow.
- `single-tree-flows.json`:8 en/zh four-width A/B/A locking, exact recovery source/input focus,
  no automatic retry, keyboard secondary menu, expanded-help fit, first-connect/last-disconnect focus.
- `single-tree-axe.json`:4 scoped WCAG A/AA/2.1 AA scans (English desktop/Chinese mobile empty/connected)
  found no automatic violations; this does not establish complete accessibility.
- Raw same-origin `/favicon.ico` observations are retained separately from business API assertions.
  No unintended business API or real external write was observed; icon loading is not accepted.
- The first current matrix attempt found a stopped local preview (connection refused), not a product
  failure. The preview was restored and the actual complete runs above were captured afterward.

## Inspectable captures

Actual production App/router/shell/components with synthetic Account,Computer,configuration and operation
responses. No live repository,connection or runtime preparation was performed. The refreshed PNGs in this
commit show the current collection-local action; retired evidence was removed (Git history retains it).

- `memory-after-en-1440-{empty,connected,offline-active,cloud}.png`:English desktop.
- `memory-after-zh-390-{empty,connected,offline-active,cloud}.png`:Chinese mobile.
- `memory-connect-zh-320.png`:narrow connection form.
- `memory-disconnect-en-390.png`:confirmation.
- `memory-uncertain-en-390.png` and `memory-uncertain-help-zh-320.png`:A/B/A recovery and expanded help.

Current-revision native gates, CI and reviewer clearance must be observed separately at publication.
Local results do not establish deployed acceptance or permission/runtime behavior. The PR body must embed
these actual captures at the published revision; older header/counter screenshots are not current evidence.
