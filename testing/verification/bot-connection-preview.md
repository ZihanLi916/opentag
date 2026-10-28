# Bot connection preview acceptance

Date: 2026-10-23 (Asia/Shanghai).

## Initial provenance (2026-10-23)

- Public source: https://github.com/first-tree-ai/opentag
- Base commit: `0464c2869950eee0c4f60862f93984325ca3aa05`.
- Local branch: `design/bot-connection-ux` (the user's requested design branch).
- No GitHub fork was created: the available browser was signed out and GitHub CLI
  was not installed. No account credentials were requested or extracted.
- The official remote is named `upstream`, with local push URL `DISABLED`.
- At initial extraction, changes were uncommitted; nothing was pushed and no PR was created.
- The initial extraction left production setup presentation unchanged. The later
  third-step visual refinement below updates messaging presentation only. State
  logic, APIs, Daemon configuration, provider settings and upstream main are unchanged.

## Verified

The story under test is: standalone UI entry → production setup presentation →
in-memory adapter transitions → production waiting/recovery/completion rendering.

| Boundary | Evidence |
| --- | --- |
| Dependencies | Frozen lockfile installed with pnpm 10.12.1, Node 24.19.0; lockfile unchanged |
| Static checks | Web TypeScript `tsc --noEmit` passed; targeted Biome check passed (10 files); `git diff --check` passed |
| Bundle | Complete `pnpm --filter @opentag/web build:bot-preview` passed, including shared package preparation |
| Behavior and isolation | `src/bot-preview/playground.test.tsx`: 3 tests passed; assertions include zero fetch calls, inert QR destination, failure/approval/handoff/completion, and fresh Slack query state after reset |
| Local endpoint | Standalone entry returns HTTP 200; `/api/v1/agents` returns HTTP 403 |
| Feishu browser journey | Provider card → demo QR → simulated authorization → waiting handoff → ready |
| Slack browser journey | Provider card → demo code input → Connect → waiting verification dialog → close → simulated handoff → ready |
| Navigation boundary | Clicking Slack's Open DM link kept the browser on localhost |
| Recovery UI | Recovery fixture and disconnect confirmation opened; Keep connected returned to the fixture |
| Locale and theme | Chinese and English switched through the visible control; dark mode toggled |
| Browser runtime | No console errors during the verified provider flows; rebuilding shared dependencies while Vite was running produced transient HMR errors, cleared by a reload |
| Editing loop | A temporary source attribute appeared immediately in the browser via HMR, then was removed; no production files were changed for this check |

Screenshots:

- [Chinese light entry](../web-ui/bot-connection-preview/connection-zh.png)
- [English dark entry](../web-ui/bot-connection-preview/connection-en-dark.png)

The initial development build exposed an upstream browser export containing an
unused `node:crypto` import. A preview-only throwing stub resolves module loading;
it neither implements hashing nor changes production shared code. A first Slack
test clicked its initially disabled button before the fixture query completed;
the test now waits for the real enabled state. The final focused suite passed.

## Third-step visual refinement

Only messaging setup gains compact settings rows, reduced local spacing and
smaller typography/icons. The existing page frame, progress rail and earlier
steps retain their presentation. The preview toolbar stacking level is lowered
so it does not cover the Slack dialog. Handlers and connection state transitions
are unchanged.

- Focused playground and Slack custom-app suite: 4 tests passed across 2 files.
- Web TypeScript and preview build passed; targeted Biome passed with four
  pre-existing CSS specificity warnings in the logo theme selectors.
- Browser checked at 815px: 16px section heading, no horizontal overflow,
  Feishu QR entry, cancellation/recovery and Slack dialog entry.
- [Updated Chinese entry](../web-ui/bot-connection-preview/connection-settings-zh.png).

## Saved-authorization hierarchy refinement

The third step now has a single connection/recovery heading and a secondary Agent
setup label. Saved Feishu authorization uses an identity/status summary, a details
disclosure and a separate action footer. Existing refresh, cancellation, polling
and focus semantics are retained; the focus assertion now targets the connection
heading. Other consumers retain the default activation presentation.

- 135 tests passed across agent setup, durable activation, isolated playground
  and shared Feishu setup suites.
- Web TypeScript and targeted Biome passed (the four existing logo specificity
  warnings remain).
- Browser verified the temporary-failure fixture, details expansion/collapse and
  check action. Preview remains an in-memory simulation.
- [Updated retry state](../web-ui/bot-connection-preview/connection-retry-grouped-zh.png).

## Upwork-inspired presentation (2026-10-27)

- Public Upwork homepage required human verification; the visual reference was
  PORTO ROCHA's public Upwork case study, not an authenticated Upwork dashboard.
- Applied messaging-only semantic colors, white surfaces, 28px heading, clearer
  borders and a green primary action. Other setup steps keep their existing palette.
- TypeScript passed; 32 tests passed across activation, shared Feishu setup,
  preview interaction and design token suites. The generated theme check passed.
- Browser verified disclosure interaction and 390px layout (342px card, no
  horizontal overflow), then restored the normal viewport. Main action text is
  white on the green background. Preview controls are hidden in the delivery.
- [Clean Upwork-inspired preview](../web-ui/bot-connection-preview/connection-upwork-zh.png).

## Teal settings layout (2026-10-27)

- Replaced connection green with existing openTag teal `#00cbb4` and dark action
  text. The third-step frame now groups progress in a left sidebar and content on
  the right, with a 22px heading, smaller controls and consistent section spacing.
  Earlier step pages and connection handlers are unchanged.
- Seven tests passed across the design-token and isolated playground suites.
  Generated theme verification, preview build and diff whitespace checks passed.
  Targeted Biome completed with the same four existing logo specificity warnings.
- Browser verified disclosure expansion/collapse and the check action. At 390px,
  progress moves above the content; document width equals viewport width without
  horizontal overflow. Computed action colors are `rgb(0, 203, 180)` and
  `rgb(37, 40, 45)`. Desktop viewport was restored and controls hidden for delivery.
- [Clean teal settings preview](../web-ui/bot-connection-preview/connection-macos-teal-zh.png).

## Recovery card alignment (2026-10-27)

- Grouped blocked-provider identity, warning and guidance in a bordered summary
  card. Disconnect and recovery now share a footer, with the primary recovery
  action last in visual and keyboard order. Existing handlers, busy states and
  disconnect confirmation are retained.
- Agent setup and playground suites passed: 110 tests. Web TypeScript passed.
  Targeted Biome passed with four existing logo specificity warnings.
- Browser checked the failed Feishu authorization view, disconnect confirmation
  and Keep connected return. At 390px the document has no horizontal overflow.
  Preview controls remain hidden.
- [Recovery layout](../web-ui/bot-connection-preview/connection-recovery-settings-zh.png).

## Consistent connection states (2026-10-27)

- Scanning, Slack authorization waiting, handoff and completion use the settings
  frame and state-card composition. QR is 176px, instructions adapt from two
  columns to one on phones, and expiry/cancellation share a footer. Handoff refresh
  and Slack's existing configuration entry join the action row. The configuration
  component remains in one stable tree position across state changes.
- DoneStep opts into settings presentation only in Agent setup. Shared default
  consumers retain their existing rendering and completion/action callbacks.
- 133 tests passed across Agent setup, creation steps, isolated playground and
  Slack custom-app suites. Web TypeScript, preview build and targeted Biome passed
  (four pre-existing logo specificity warnings; existing bundle-size warning).
- Browser checked QR cancellation and retry; Slack handoff refresh, Continue
  dialog open/close and simulated transition to ready; Feishu ready rendering.
  QR and Slack handoff document widths equal 390px viewport width. Mobile success
  was visually inspected. Desktop was restored and controls hidden for delivery.
- [QR preview](../web-ui/bot-connection-preview/connection-scan-settings-zh.png)
  and [success preview](../web-ui/bot-connection-preview/connection-success-settings-zh.png).

## Inline authorization and actionable failures (2026-10-27)

- Replaced the sidebar/window framing with a 760px single-column workspace,
  horizontal progress, 28px heading and paired provider choices. Both providers
  authorize in the same page; Slack uses an opt-in inline presentation while other
  consumers keep the dialog. Authorization protocols and action handlers remain.
- Recognized Feishu and Slack codes now take precedence over generic failure
  labels, including errors on existing credentials. Recovery shows a reason,
  next-step advice and optional error-code disclosure; absent/unknown causes are
  explicit. Saved authorization also explains runtime and temporary-check states.
- Added regression coverage for expired QR, upstream outage, missing Slack scopes,
  unrecognized codes, and inline close/focus restoration. Updated existing manual
  Slack save tests to verify the inline region remains open after a binding change.
- 156 tests passed across Agent setup, activation, Feishu setup, Slack custom app
  and playground suites. TypeScript and preview build passed. Targeted Biome
  retains four existing logo specificity warnings; bundle-size warning remains.
- Browser verified inline Slack demo-code submission through verification and
  close, and service-failure details expansion. Slack inline at 390px had no
  horizontal overflow. Preview error causes are local fixtures, not live reports.
- [Failure diagnostics](../web-ui/bot-connection-preview/connection-failure-refined-zh.png)
  and [inline Slack](../web-ui/bot-connection-preview/connection-slack-inline-zh.png).

## Compact typography and aligned authorization (2026-10-27)

- Tightened the messaging column to 720px, page heading to 24px, card insets to
  16px and action controls to 32px. Reduced progress/header and content spacing.
- Feishu and Slack share the title/description start position and bottom action
  area. Feishu keeps a 176px QR beside the instructions on desktop. Slack inline
  automatic and manual forms receive an optional cancel action in their native
  form footer; dialog consumers keep their existing layout and behavior.
- 155 tests passed across Agent setup, activation, Slack custom app, Slack auto
  connect and preview suites. TypeScript and standalone preview build passed.
  Targeted Biome reports only the four existing logo specificity warnings;
  the existing preview bundle-size warning remains. Git whitespace check passed.
- Browser checked both providers at desktop and 390px width, manual setup/Back,
  native Enter submission of a mock Slack code, post-save verification/close,
  and Feishu cancellation. All credentials and provider responses were fixtures.
- Final views hide preview/simulation controls:
  [Feishu](../web-ui/bot-connection-preview/connection-feishu-compact-zh.png) and
  [Slack](../web-ui/bot-connection-preview/connection-slack-compact-zh.png).

## Final connection UX validation (2026-10-27)

- Preserved the compact settings layout. Slack now names the target workspace,
  message composer, permission confirmation and challenge-code source. Feishu
  explains scan, mobile approval and returning to the automatically updating page.
- Pending writes show the operation and an honest slow-request message after 15s;
  no write deadline or automatic replay was added. Read requests use the existing
  10s deadline and retain last-known state with an explicit stale-status notice.
- Invalid/expired Slack challenges offer explicit reauthorization and clear the
  old code after a response. Network failures retain explicit same-operation retry.
  Existing creation-uncertain and administrator-denied safeguards remain intact.
- QR pixels disappear at local expiry without fabricating a terminal Server state.
  Server-expired attempts expose the existing permitted restart action. Unknown
  causes remain unknown; provider codes are available through diagnostics.
- Slack readiness requires verified App identity plus an active, ready handoff.
  OAuth save is reported as pending verification. Ready pages explicitly require
  a real message/reply check; there is no automatic message-delivery assertion.
- Reused design-system headings/selects, linked field help via aria-describedby,
  status/alert announcements, close/focus restoration, reduced-motion handling
  and 44px coarse-pointer action targets. No production dependency was added.

### Automated checks

- Full Web suite: **179 files / 2,263 tests passed** (`vitest run --maxWorkers=2`).
  The first full run found six regressions in heading expectations, the isolated
  CSS-entry seam and locale ordering/unused entries. These were corrected before
  the final complete green run; no failing tests were suppressed or skipped.
- Web TypeScript: `tsc --noEmit` passed.
- Normal Web build: `vite build` passed.
- Standalone preview build: `vite build --config vite.bot-preview.config.ts` passed.
- Root `pnpm check` (pinned pnpm 10.12.1) and `git diff --check` passed.
- Builds retain the existing chunk-size warning. Repository lint retains existing
  warnings (including four logo specificity warnings); checks report no errors.
- Frontend scope covers changed UI and consumers. Backend/CLI/integration suites
  were not run because no server, runtime, schema, API protocol or dependency code
  changed. CI's complete matrix still needs to pass before merge.

### Browser checks and evidence

All provider outcomes below use the isolated memory adapter. They validate actual
rendered components and local interaction, **not live provider authorization or
message delivery**. No real credentials were entered and no demo QR was scanned.

- Desktop: Slack command, code help, Enter submission of `demo-invalid`, failure,
  explicit reauthorization, a new ticket and empty code field; manual setup/Back;
  successful fixture save remains pending until a separate readiness event.
- Feishu: scan, approval pending, permissions disclosure, refresh, saved-authorization
  handoff, simulated ready; expired fixture recovery returns to a fresh QR.
- Widths: 320/390/768/1440px for both providers; Chinese and English 390px Slack.
  No horizontal overflow; long help text and action footer remain usable.
- Keyboard: Tab from the code field reaches Manual setup; closing returns focus
  to the original Slack entry. Code and command help IDs resolve. No console errors
  were captured in the final browser sessions. Screen-reader hardware and physical
  touch devices were not tested.
- [Slack instructions](../web-ui/bot-connection-preview/final-slack-guidance-zh.png)
- [Slack reauthorization](../web-ui/bot-connection-preview/final-slack-recovery-zh.png)
- [Feishu scan](../web-ui/bot-connection-preview/final-feishu-scan-zh.png)
- [Feishu expired recovery](../web-ui/bot-connection-preview/final-feishu-expired-zh.png)
- [Ready, with delivery still to verify](../web-ui/bot-connection-preview/final-ready-zh.png)
- [390px English Slack](../web-ui/bot-connection-preview/final-mobile-slack-en.png)
- [390px Chinese Feishu](../web-ui/bot-connection-preview/final-mobile-feishu-zh.png)

### Self-review

- Checked single-flight requests, slow/uncertain responses, stale reads, unmount
  cleanup, QR expiry, denied approval and unknown error-code fallbacks.
- Compared Slack/Feishu headers, descriptions, card insets and action placement.
  Default Slack dialog consumers retain their presentation; setup opts into inline.
- Reviewed changed-file scope and generated theme consistency. Connection palette
  aliases support this flow only; general product colors are unchanged. Test
  expectation changes retain route/completion assertions. The one new CSS import
  is the isolated preview entry, not a general design-system guard exemption.
- Real integration acceptance remains required: valid and expired Slack tickets,
  invalid challenge, denied/admin approval, Feishu scan/expiry, Agent offline/online,
  then send “Hello” and observe a Bot reply in each provider. Capture service-side
  results separately; never infer these from the screenshots.

## Remaining limits

No live provider authorization, real Bot delivery, Server, database, or Daemon was
started or tested. Full monorepo tests, CI, physical-device and screen-reader tests
were not run. The production Web build and complete Web test suite did run.
The preview bundle emits Vite's existing chunk-size warning; this is not a bundle
optimization pass.

The 2026-10-27 acceptance run used the public clone on `design/bot-connection-ux`.
On 2026-10-28 the user approved publication without merging. The submission branch
is `fix/bot-connection-ux`, following the repository's branch-prefix convention;
this preserves the reviewed implementation. Upstream push remains disabled.
The two overlapping setup files merge cleanly in a three-way check against
`bd415ef217299690ac54236ed82e1c31534dcc74`; the recorded test results apply to the
reviewed base, not to a rebuilt latest-main integration. CI must validate the PR.
Local machine paths were removed from the published validation log.
The preview server must be running for its localhost URL to work; see the
[run and editing guide](../../docs/system/web/bot-connection-preview.md).
