# MCP OAuth authorization reuse

Supports [MCP Server integration](../../docs/system/capabilities/mcp-server-integration.md).

## Contract and coverage

| Behavior | Automated evidence |
| --- | --- |
| Ordinary catalog/URL Add selects a compatible existing definition, mounts it and connects without new OAuth; differing configuration and historical definitions stay independent | `mcp-installation-reuse.test.ts`, Web installation-reuse and installation suites |
| Oldest compatible OAuth root, exact connection configuration, scopes and client boundary; no token exchange on reuse | `mcp-shared-authorization.test.ts`, `mcp-oauth-flow-service.test.ts` |
| One authentication state and flow across Agent mounts; local probes and enable switches remain independent | shared-authorization Server and Web suites; shared settings and normalized authentication cache |
| Holder handoff preserves root ID, creation time, refresh claim/generation and flow; successor retains its own tool snapshot | PostgreSQL `integration/mcp-shared-authorization.test.ts` |
| Refresh before/after handoff, callback before/after handoff, one-use code exchange, stale result after reauthorization or complete disconnect | PostgreSQL shared-authorization suite with controlled network barriers |
| Agent deletion, ownership transfer and onboarding reset retain or remove the correct credential family | PostgreSQL shared-authorization and management concurrency suites |
| Account admission serializes short graph writes; another Agent can connect and use an access credential while refresh waits on the network | PostgreSQL management concurrency and shared-authorization suites |
| Scope-safe disconnect; family identity/member count must still match; legacy revoke remains Agent-scoped | shared-authorization and management HTTP suites |
| Shared consent cancellation preserves a usable credential, refresh claim and tool snapshots; old revision cannot cancel a newer flow | shared-authorization Server and Web suites |
| Failed discovery publishes no flow or credential; a reserved root ID fences detach/recreate during discovery | OAuth and shared-authorization service suites |
| Unknown refresh outcome clears potentially spent material; stale claims are not replayed; pre-dispatch failure preserves unspent material | OAuth service suite |
| Legacy response shapes stay strict; new batch status, Connect, flow cancel and family disconnect contain no credential material | management HTTP suite and shared public-export snapshot |
| New reuse disabled by default; existing references still read and hand off; old downgrade blocked by references/new envelope formats | shared-authorization suite and read-only rollout-status command |

Tests use synthetic credentials. No production credential or provider payload is stored in this record.

## Local validation

The full PostgreSQL command and targeted repairs cover all 80 files / 1,018 tests. The first run had two unexecuted suites because a concurrent dependency rebuild temporarily removed the shared package output, plus three handoff failures caused by a missing import during integration with the current Agent self-configuration code. After the import was restored and dependency builds had finished, all four affected files passed again (162 tests). The other 76 files passed in the full run. No filtered run with zero tests is counted as coverage.

The affected Server suites cover nine files / 304 tests, including OAuth, credential envelopes, authorization, installation selection, management HTTP and Agent self-configuration HTTP. The Web MCP suites cover 30 files / 387 tests; one test-fixture cleanup failure was corrected and the two installation suites passed again (10 tests). Shared contracts passed 48 files / 778 tests. The workspace build, all 12 workspace type-check tasks and repository checks passed separately.

The migration-count assertions now expect 72 migrations. Four management concurrency cases observe the intended Account lock wait before both writes commit, using independent PostgreSQL connections and bounded release paths.

## Browser validation

Actual React components were rendered in Chromium with synthetic Account API responses. Forty checks passed across 320, 390, 768 and 1440px: connected state while consent is running, common cancellation controls, current/all disconnect scope, Cancel initial focus, Escape/focus restoration, page/dialog overflow and complete visibility of every disconnect button. The shared settings passed axe WCAG 2 A/AA checks at all four widths. No page errors or external requests occurred.

Visual inspection found that the third disconnect button could push Cancel outside the 320px dialog even though scroll-width checks passed. The existing action row now wraps; button bounding boxes are checked against both the dialog and viewport. Local screenshots of the corrected mobile dialog and desktop/mobile settings were inspected. The fixture, screenshots and JSON results are local verification output, not a live-provider or staging run; no new theme token or design-system exception was introduced.

## Installation-entry regression

The normal catalog and URL-add journeys used to create a separate definition for every installation, so testing only pre-mounted identical definition IDs missed the main entry path. The Server now selects one compatible existing OAuth installation before creation; both Web entry points exercise lookup, mount and Connect together. Connect also attempts reuse for a new mount whose local UI describes its first authorization as reauthorization; only an actual existing authentication prevents source selection.

The lookup reuses the same root eligibility query as Connect, including explicit catalog scopes. It requires matching definition defaults as well as the source mount so a different inherited endpoint cannot be mounted accidentally. Tests cover independent historical definitions, changed headers/URL/kind, expired credentials, invalid client/resource proof, Account ownership, the disabled gate and revocation between lookup and Connect. PostgreSQL also exercises lookup and mounting while the root refresh is waiting on the network.

Agent self-configuration keeps the opt-in checks and cannot call the Account-only lookup/Connect endpoints. Its OAuth browser handoff consumes proof under Account admission and the stable root identity. The handoff is exercised after holder transfer and remains single use.

## Review regression coverage

The BrowserApi CSRF inventory includes all six shared-authentication methods. It exercises outgoing requests rather than mocked domain methods, verifies the double-submit header on every mutation, and explicitly checks JSON content types for installation lookup, Connect, shared cancellation and family disconnect. These four requests previously omitted both headers even though component mocks passed.

PostgreSQL regressions run a tool probe across a successful refresh that narrows or clears granted scopes. Both holder and reference snapshots must become pending with no tools, and the old probe must not restore its result. Scope ordering, duplicates and lifecycle-only `offline_access` changes retain snapshots; an explicitly empty granted scope remains empty rather than inheriting requested scopes. Separate installation tests make an old envelope unreadable and verify selection of a later valid source or return to ordinary OAuth without mutating the unreadable source.

OAuth denial and callback-failure regressions exercise the shared authentication query through the real session hook and browser notification channel. Both cases fail before the repair: the local session settles while the shared row remains cached as authorizing. Every settled attempt now invalidates authentication and mount reads, including failure and cancellation.

The browser smoke fixtures explicitly serve the batch authentication, installation lookup and Connect endpoints when reuse is disabled, instead of parsing collection names as Server IDs. Real OAuth journeys assert the common Connected status and preservation of existing tools during reauthorization. Failed OAuth preparation preserves the previously working key until a successful consent replaces it.

The review repair is validated by 22 MCP Server unit files / 761 tests, the shared-authentication PostgreSQL file / 15 tests, and two BrowserApi files / 34 tests. Repository checks, type checks and builds run separately. The subsequent Web MCP regression run passes 30 files / 389 tests. Local full Browser Smoke covers all 113 tests: 112 passed in the full run; one strict locator ambiguity was corrected and that case passed separately. Retries were disabled. Web build and Web/E2E type checks pass; the final remote matrix remains required. No schema or rendered layout changes are part of this repair, so the original migration and browser evidence remains scoped to the initial implementation.

## Deployment acceptance

Local tests do not establish a deployed feature or a GitHub business operation. This change defaults `OPENTAG_MCP_OAUTH_REUSE` to false. Upgrade and drain every old Server/Worker before enabling it; turning it off later must not disable existing references.

Staging acceptance should authorize the first Agent, then use the ordinary catalog or URL Add entry on a second Agent and verify selection of the same definition without another provider consent/token exchange. Verify identical authentication states and flow controls, separate probes, Issue/PR reads and writes, user identity on a code commit, current-only removal, complete-family removal and continued access for any independent credential. Local and Cloud executions use the same Server gateway resolver.

For a legacy downgrade, quiesce OAuth writes and run `pnpm --filter @opentag/server mcp:rollout-status` with the deployment database and encryption configuration. The command prints counts only and exits nonzero for references, versioned credentials/flows or unreadable envelopes. A compatible rollback is preferred; do not copy refresh tokens or reverse the migration.
