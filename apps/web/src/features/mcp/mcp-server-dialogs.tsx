import type { MCPAgentServer } from "@opentag/shared/browser";
import { useRef, useState } from "react";
import * as m from "../../paraglide/messages.js";
import { Button, Dialog } from "../../ui/design-system.js";
import { useDetachMcpServer, useDisconnectMcpFamily, useMcpAuthentications } from "./mcp-queries.js";
import { deleteMcpInstallation } from "./mcp-setup-cleanup.js";
import { mcpTitle } from "./mcp-title.js";

export function McpConfirmDialog({
  agentId,
  entry,
  onClose,
  onConfirmed,
}: {
  agentId: string;
  entry: MCPAgentServer;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const detach = useDetachMcpServer(agentId);
  const family = useDisconnectMcpFamily(agentId);
  const authentications = useMcpAuthentications(agentId);
  const view = authentications.data?.authorizations.find((view) => view.mcpServerId === entry.mcpServerId);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const submit = async (all = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      if (all && view?.authenticationId)
        await family.mutateAsync({
          mcpServerId: entry.mcpServerId,
          authenticationId: view.authenticationId,
          agentCount: view.agentCount,
        });
      else await deleteMcpInstallation(agentId, entry.mcpServerId, detach.mutateAsync);
      onConfirmed();
    } catch {
      setError(m.mcp_remove_retry({ server: mcpTitle(entry) }));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Dialog
      className="mcp-confirm-dialog"
      role="alertdialog"
      showCloseButton={false}
      busy={busy}
      description={m.mcp_remove_description({ server: mcpTitle(entry) })}
      initialFocusRef={cancelRef}
      onClose={onClose}
      title={m.mcp_detach_title({ server: mcpTitle(entry) })}
    >
      {view && view.agentCount > 1 ? (
        <p className="mt-4">{m.mcp_shared_remove({ count: view.agentCount - 1 })}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-kumo-danger">
          {error}
        </p>
      ) : null}
      <footer className="mcp-confirm-actions">
        <Button ref={cancelRef} disabled={busy} variant="ghost" onClick={onClose}>
          {m.common_cancel()}
        </Button>
        <Button
          aria-label={m.mcp_remove_action()}
          disabled={busy}
          loading={busy}
          variant="danger"
          onClick={() => void submit()}
        >
          {m.mcp_remove_action()}
        </Button>
        {view && view.agentCount > 1 ? (
          <Button variant="danger" disabled={busy} onClick={() => void submit(true)}>
            {m.mcp_shared_remove_all()}
          </Button>
        ) : null}
      </footer>
    </Dialog>
  );
}
