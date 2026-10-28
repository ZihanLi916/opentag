import type { MCPAuthenticationView } from "@opentag/shared/browser";
import { useQueryClient } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { browserApi } from "../../api.js";
import { useMcpConnectionOperation } from "./mcp-connection.js";
import type { McpOAuthSession } from "./mcp-oauth-session.js";
import { newerMcpAuthentication, useSharedMcpAuthentication } from "./mcp-queries.js";
import { McpServerCard } from "./mcp-server-card.js";
import { McpSharedAuthentication } from "./mcp-shared-authentication.js";
import { AGENT_ID, authorization, entry, SERVER_ID, stub, wrap } from "./mcp-test-fixtures.js";

const view: MCPAuthenticationView = {
  mcpServerId: SERVER_ID,
  authenticationId: AGENT_ID,
  authenticationRevision: 1,
  credentialGeneration: 0,
  status: "connected",
  failureCode: null,
  authorizationExpiresAt: null,
  flowExpiresAt: null,
  agentCount: 2,
};
afterEach(() => vi.restoreAllMocks());
describe("shared authentication presentation", () => {
  it("shows the same connected state despite different local probes and OAuth windows", async () => {
    const a = entry({
      authorization: {
        ...authorization(),
        kind: "oauth",
        probeState: "failed",
        probeError: "MCP_AUTHORIZATION_REQUIRED: rejected",
      },
    });
    const b = entry({
      mcpServerId: AGENT_ID,
      authorization: { ...authorization(), kind: "oauth", probeState: "pending" },
    });
    wrap(
      <>
        <McpServerCard
          entry={a}
          authentication={view}
          onAction={vi.fn()}
          onResume={vi.fn()}
          resuming={false}
          oauthSession={{ phase: "waiting" } as McpOAuthSession}
        />
        <McpServerCard
          entry={b}
          authentication={{ ...view, mcpServerId: AGENT_ID }}
          onAction={vi.fn()}
          onResume={vi.fn()}
          resuming={false}
        />
      </>,
    );
    await waitFor(() => expect(screen.getAllByText("Connected")).toHaveLength(2));
    expect(screen.queryByRole("button", { name: /Reauthorize|Authorize/ })).toBeNull();
    expect(screen.queryByText("Waiting for authorization")).toBeNull();
  });
  it("shows the same authorization entry while another Agent is authorizing", async () => {
    const a = entry({ authorization: { ...authorization(), kind: "oauth", status: "error", hasCredential: false } });
    const b = { ...a, mcpServerId: AGENT_ID };
    wrap(
      <>
        <McpServerCard
          entry={a}
          authentication={{ ...view, status: "authorizing" }}
          onAction={vi.fn()}
          onResume={vi.fn()}
          resuming={false}
        />
        <McpServerCard
          entry={b}
          authentication={{ ...view, status: "authorizing", mcpServerId: AGENT_ID }}
          onAction={vi.fn()}
          onResume={vi.fn()}
          resuming={false}
        />
      </>,
    );
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Authorize: linear" })).toHaveLength(2));
  });
  it("updates both Agent cards from one authentication cache entry", async () => {
    const server = entry({ authorization: { ...authorization(), kind: "oauth" } });
    function Cards() {
      const cache = useQueryClient();
      const a = useSharedMcpAuthentication(view);
      const b = useSharedMcpAuthentication({ ...view });
      return (
        <>
          <button
            type="button"
            onClick={() =>
              cache.setQueryData(["mcp", "authentications", "root", AGENT_ID], {
                ...view,
                status: "authorization_required",
              })
            }
          >
            Invalidate authentication
          </button>
          <McpServerCard entry={server} authentication={a} onAction={vi.fn()} onResume={vi.fn()} resuming={false} />
          <McpServerCard
            entry={{ ...server, mcpServerId: AGENT_ID }}
            authentication={b}
            onAction={vi.fn()}
            onResume={vi.fn()}
            resuming={false}
          />
        </>
      );
    }
    wrap(<Cards />);
    fireEvent.click(await screen.findByText("Invalidate authentication"));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Reauthorize: linear" })).toHaveLength(2));
  });
  it("does not overwrite newer credentials with a late response at the same row revision", () => {
    const fresh = { ...view, credentialGeneration: 2 };
    expect(newerMcpAuthentication(fresh, { ...view, credentialGeneration: 1, status: "authorization_required" })).toBe(
      fresh,
    );
  });
  it("provides the same shared-flow cancellation control in both Agent settings", async () => {
    const server = entry({ authorization: { ...authorization(), kind: "oauth" } });
    stub([server]);
    const current = { ...view, flowExpiresAt: "2030-01-01T00:00:00.000Z" };
    wrap(
      <>
        <McpSharedAuthentication agentId={AGENT_ID} entry={server} authentication={current} />
        <McpSharedAuthentication agentId={SERVER_ID} entry={server} authentication={current} />
      </>,
    );
    const buttons = await screen.findAllByRole("button", { name: "Cancel" });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1] as HTMLElement);
    await waitFor(() =>
      expect(browserApi.cancelSharedMcpOAuth).toHaveBeenCalledWith(SERVER_ID, SERVER_ID, AGENT_ID, 1),
    );
  });
  it("completes a reused connection without starting OAuth or waiting for tools", async () => {
    stub([]);
    vi.mocked(browserApi.connectMcpOAuth).mockResolvedValue({ connected: true });
    const oauth = vi.spyOn(browserApi, "startMcpOAuth");
    const probe = vi.spyOn(browserApi, "probeMcpServer");
    function Connect() {
      const connection = useMcpConnectionOperation(AGENT_ID);
      const [done, setDone] = useState(false);
      return (
        <button
          type="button"
          onClick={() =>
            void connection
              .run({ binding: entry({ authorization: null }), kind: "oauth" }, { source: "add", isAlive: () => true })
              .then((result) => setDone(result === "connected"))
          }
        >
          {done ? "Done" : "Connect"}
        </button>
      );
    }
    wrap(<Connect />);
    fireEvent.click(await screen.findByText("Connect"));
    await screen.findByText("Done");
    expect(browserApi.connectMcpOAuth).toHaveBeenCalledTimes(1);
    expect(oauth).not.toHaveBeenCalled();
    expect(probe).not.toHaveBeenCalled();
  });
});
