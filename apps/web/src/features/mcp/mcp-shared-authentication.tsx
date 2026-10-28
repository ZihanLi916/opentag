import type { MCPAgentServer, MCPAuthenticationView } from "@opentag/shared/browser";
import { useRef, useState } from "react";
import * as m from "../../paraglide/messages.js";
import { Button } from "../../ui/design-system.js";
import { connectionPreset } from "./mcp-connection-model.js";
import { authenticationFeedback } from "./mcp-feedback.js";
import { type McpOAuthSession, useMcpOAuthSessions } from "./mcp-oauth-session.js";
import { useCancelSharedMcpOAuth } from "./mcp-queries.js";

export function McpSharedAuthentication({
  agentId,
  entry,
  authentication,
}: {
  agentId: string;
  entry: MCPAgentServer;
  authentication: MCPAuthenticationView;
}) {
  const sessions = useMcpOAuthSessions(agentId);
  const cancel = useCancelSharedMcpOAuth(agentId);
  const pending = useRef<McpOAuthSession | undefined>(undefined);
  const feedbackVersion = JSON.stringify([
    authentication.authenticationRevision,
    authentication.failureCode,
    authentication.flowExpiresAt,
  ]);
  const [failedVersion, setFailedVersion] = useState<string>();
  const error = failedVersion === feedbackVersion;
  const flow = Boolean(authentication.flowExpiresAt);
  const feedback = authenticationFeedback(authentication);
  const session = sessions(`${authentication.authenticationId}:${authentication.authenticationRevision}`);
  const authorize = () => {
    if (session.phase === "preparing") return;
    setFailedVersion(undefined);
    pending.current = session;
    void session
      .start(
        { agentId, serverId: entry.mcpServerId, source: "edit" },
        connectionPreset(entry.effective.url)?.oauthScopes,
      )
      .catch(() => setFailedVersion(feedbackVersion));
  };
  const cancelFlow = async () => {
    if (!authentication.authenticationId || !authentication.authenticationRevision) return;
    setFailedVersion(undefined);
    try {
      await cancel.mutateAsync({
        mcpServerId: entry.mcpServerId,
        authenticationId: authentication.authenticationId,
        expectedRevision: authentication.authenticationRevision,
      });
      // The guarded browser cleanup cannot cancel a newer shared flow.
      await pending.current?.cancel();
    } catch {
      setFailedVersion(feedbackVersion);
    }
  };
  return (
    <section className="grid gap-3" aria-label={m.mcp_auth_label()}>
      <div className="flex items-center justify-between gap-3">
        <span>{m.mcp_auth_oauth()}</span>
        <Button
          type="button"
          disabled={cancel.isPending || session.phase === "preparing"}
          onClick={() => (flow ? void cancelFlow() : authorize())}
        >
          {flow ? m.common_cancel() : m.mcp_auth_again()}
        </Button>
      </div>
      <p role="status" className="text-sm text-kumo-subtle">
        {flow ? m.mcp_waiting_authorization() : feedback.label}
      </p>
      {pending.current?.blocked && pending.current.expiresAt === authentication.flowExpiresAt ? (
        <Button variant="inline" onClick={pending.current.openFallback}>
          {m.mcp_oauth_open_page()}
        </Button>
      ) : null}
      {authentication.failureCode || error ? (
        <p role="alert" className="text-sm text-kumo-danger">
          {m.mcp_authorization_issue()}
        </p>
      ) : null}
    </section>
  );
}
