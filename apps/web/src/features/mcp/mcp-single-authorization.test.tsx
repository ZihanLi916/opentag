import type { MCPAuthenticationView } from "@opentag/shared/browser";
import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { browserApi } from "../../api.js";
import type { McpOAuthSession } from "./mcp-oauth-session.js";
import { McpPage } from "./mcp-page.js";
import { McpServerCard } from "./mcp-server-card.js";
import { AGENT_ID, authorization, entry, openDetails, SERVER_ID, stub, wrap } from "./mcp-test-fixtures.js";

const authentication: MCPAuthenticationView = {
  mcpServerId: SERVER_ID,
  authenticationId: AGENT_ID,
  authenticationRevision: 1,
  credentialGeneration: 0,
  status: "connected",
  failureCode: null,
  authorizationExpiresAt: null,
  flowExpiresAt: null,
  agentCount: 1,
};
afterEach(() => vi.restoreAllMocks());
describe("single-Agent OAuth list with an authentication view", () => {
  it.each(["ready", "failed", "pending", "empty"] as const)(
    "preserves the ordinary %s row after the authentication view loads",
    async (state) => {
      const mounted = entry({
        authorization: {
          ...authorization(),
          kind: "oauth",
          probeState: state === "failed" ? "failed" : state === "pending" ? "pending" : "succeeded",
          probeError: state === "failed" ? "MCP_UPSTREAM_UNAVAILABLE: timeout" : null,
          toolsCount: state === "empty" ? 0 : state === "pending" ? null : 3,
        },
        snapshot: state === "pending" ? null : entry().snapshot,
      });
      stub([mounted]);
      vi.mocked(browserApi.mcpAuthentications).mockResolvedValue({ authorizations: [authentication] });
      wrap(<McpPage agentId={AGENT_ID} />);
      await openDetails();
      const details = screen.getByRole("dialog", { name: "linear" });
      await within(details).findByText("Connected");
      fireEvent.click(within(details).getByRole("button", { name: "Close linear" }));
      const row = screen.getByRole("button", { name: "linear" }).closest("li") as HTMLElement;
      expect(within(row).queryByText("Connected")).toBeNull();
      if (state === "failed") {
        expect(within(row).getByText("Request timed out")).toBeTruthy();
        expect(within(row).getByRole("button", { name: "Retry: linear" })).toBeTruthy();
      } else if (state === "pending") expect(within(row).getByText("Checking connection…")).toBeTruthy();
      else if (state === "empty") expect(within(row).getByText("No tools available")).toBeTruthy();
      else expect(within(row).queryByRole("button", { name: /Retry|Authorize/ })).toBeNull();
    },
    20_000,
  );
  it("keeps Remove disabled while its own OAuth popup is open", async () => {
    wrap(
      <McpServerCard
        entry={entry({ authorization: { ...authorization(), kind: "oauth" } })}
        authentication={authentication}
        onAction={vi.fn()}
        onResume={vi.fn()}
        resuming={false}
        oauthSession={{ phase: "waiting" } as McpOAuthSession}
      />,
    );
    await screen.findByText("Waiting for authorization…");
    expect(screen.getByRole("button", { name: "Remove linear" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: /Authorize|Reauthorize/ })).toBeNull();
  });
});
