import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readMcpRolloutStatus } from "../admin/mcp-rollout-status.js";
import { agentMcpServers, agents, mcpServerAuthorizations } from "../db/schema/index.js";
import { MCP_ERROR_CODES } from "../services/mcp/errors.js";
import { McpServerService } from "../services/mcp/mcp-server-service.js";
import { SHARED_PROOF, sharedMcpFixture } from "./support/mcp-shared-authorization.js";
import { createUnitDatabase, type UnitDatabase } from "./support/unit-database.js";

let unit: UnitDatabase;
beforeAll(async () => {
  unit = await createUnitDatabase();
}, 60000);
afterAll(async () => unit?.close());
beforeEach(async () => unit.reset());

describe("shared MCP authentication", () => {
  it("reuses the oldest compatible root without OAuth or a local credential", async () => {
    const f = await sharedMcpFixture(unit.database);
    const [a, b, c, d] = f.ids as [string, string, string, string];
    await f.authorize(c);
    await expect(f.connect(b)).resolves.toBe(true);
    await expect(f.connect(d)).resolves.toBe(true);
    expect(await f.row(b)).toMatchObject({
      credentialSourceId: f.root.id,
      ciphertext: null,
      keyId: null,
      state: null,
      refreshClaimId: null,
      accessTokenExpiresAt: null,
    });
    expect((await f.auth.buildHeaders(f.accountId, b, f.server.id)).authorization).toBe("Bearer old-access");
    expect(f.exchange).not.toHaveBeenCalled();
    expect(f.refresh).not.toHaveBeenCalled();
    expect((await f.servers.listServers(f.accountId))[0]?.authorizedAgentCount).toBe(4);
    expect((await f.servers.listAuthenticationViews(f.accountId, a))[0]).toMatchObject({
      authenticationId: f.root.id,
      status: "connected",
      agentCount: 3,
    });
  });
  it("does not wait for a refresh claim and preserves each Agent's own tool probe", async () => {
    const f = await sharedMcpFixture(unit.database);
    await unit.database
      .update(mcpServerAuthorizations)
      .set({ refreshClaimId: randomUUID(), refreshClaimedAt: new Date(), probeState: "failed", probeError: "401" })
      .where(eq(mcpServerAuthorizations.id, f.root.id));
    await f.connect(f.ids[1] as string);
    const view = (await f.servers.listAuthenticationViews(f.accountId, f.ids[1] as string))[0];
    expect(view).toMatchObject({ status: "connected", authenticationId: f.root.id });
    expect(
      (await f.servers.readAgentServer(f.accountId, f.ids[1] as string, f.server.id)).authorization?.probeState,
    ).toBe("pending");
  });
  it("reauthorizes the same root from a referring Agent and restores all members", async () => {
    const f = await sharedMcpFixture(unit.database);
    const b = f.ids[1] as string;
    await f.connect(b);
    await unit.database
      .update(mcpServerAuthorizations)
      .set({ status: "expired" })
      .where(eq(mcpServerAuthorizations.id, f.root.id));
    expect((await f.servers.listAuthenticationViews(f.accountId, b))[0]?.status).toBe("authorization_required");
    const state = await f.start(b);
    expect((await f.servers.listAuthenticationViews(f.accountId, f.ids[0] as string))[0]?.status).toBe("authorizing");
    expect(await f.flows.callback({ code: "code", state }, SHARED_PROOF)).toMatchObject({
      agentId: b,
      accountId: f.accountId,
    });
    expect((await f.row(b))?.credentialSourceId).toBe(f.root.id);
    expect((await f.auth.buildHeaders(f.accountId, b, f.server.id)).authorization).toBe("Bearer new-consent");
    expect((await f.servers.listAuthenticationViews(f.accountId, b))[0]?.status).toBe("connected");
  });
  it("records an explicitly empty granted scope instead of the requested scope", async () => {
    const f = await sharedMcpFixture(unit.database);
    const b = f.ids[1] as string;
    await f.connect(b);
    f.exchange.mockResolvedValue({ accessToken: "empty-scope", expiresIn: 3600, scope: "" });
    const state = await f.start(b);
    await f.flows.callback({ code: "code", state }, SHARED_PROOF);
    expect((await f.row(f.ids[0] as string))?.scopes).toEqual([]);
  });
  it("does not switch an existing expired binding to a different valid root", async () => {
    const f = await sharedMcpFixture(unit.database);
    const b = f.ids[1] as string;
    await f.connect(b);
    await f.authorize(f.ids[2] as string);
    await unit.database
      .update(mcpServerAuthorizations)
      .set({ status: "expired" })
      .where(eq(mcpServerAuthorizations.id, f.root.id));
    await expect(f.connect(b)).resolves.toBe(false);
    expect((await f.row(b))?.credentialSourceId).toBe(f.root.id);
  });
  it("rejects incompatible configuration, scopes, identity boundaries and disabled new reuse", async () => {
    const f = await sharedMcpFixture(unit.database);
    const b = f.ids[1] as string;
    await f.servers.updateBinding(f.accountId, b, f.server.id, { extraHeaders: { "x-account": "other" } });
    await expect(f.connect(b)).resolves.toBe(false);
    await expect(f.auth.connectOAuth(f.accountId, f.ids[2] as string, f.server.id, ["write"])).resolves.toBe(false);
    await unit.database
      .update(agents)
      .set({ status: "deleted" })
      .where(eq(agents.id, f.ids[0] as string));
    await expect(f.connect(f.ids[3] as string)).resolves.toBe(false);
  });
  it("keeps existing references readable after disabling new reuse", async () => {
    const f = await sharedMcpFixture(unit.database);
    const b = f.ids[1] as string;
    await f.connect(b);
    const disabled = new McpServerService({ database: unit.database, cipher: f.cipher });
    expect((await disabled.readAgentServer(f.accountId, b, f.server.id)).authorization).toMatchObject({
      status: "active",
      hasCredential: true,
    });
    await disabled.detachServer(f.accountId, f.ids[0] as string, f.server.id);
    expect((await f.row(b))?.id).toBe(f.root.id);
  });
  it("rejects changed shared connection settings but allows enable switches", async () => {
    const f = await sharedMcpFixture(unit.database);
    const b = f.ids[1] as string;
    await f.connect(b);
    await expect(
      f.servers.updateBinding(f.accountId, b, f.server.id, { url: "https://other.example.test/mcp" }),
    ).rejects.toMatchObject({ code: MCP_ERROR_CODES.BINDING_CONFLICT });
    await expect(
      f.servers.updateServer(f.accountId, f.server.id, { expectedRevision: f.server.revision, authScheme: "Token" }),
    ).rejects.toMatchObject({ code: MCP_ERROR_CODES.BINDING_CONFLICT });
    await f.servers.updateBinding(f.accountId, b, f.server.id, { enabled: false });
    expect((await f.servers.listAuthenticationViews(f.accountId, b))[0]?.status).toBe("connected");
  });
  it("does not publish OAuth onto a mount recreated during discovery", async () => {
    const f = await sharedMcpFixture(unit.database);
    const b = f.ids[1] as string;
    const metadata = {
      resource: f.server.url,
      authorizationServers: ["https://auth.example.test"],
      scopesSupported: ["read"],
    };
    f.oauth.protectedResourceMetadata = async () => {
      await f.servers.detachServer(f.accountId, b, f.server.id);
      await f.servers.attachServer(f.accountId, b, f.server.id, true);
      return { metadata };
    };
    await expect(f.start(b)).rejects.toMatchObject({ code: MCP_ERROR_CODES.OAUTH_FLOW_INVALID });
    expect(await f.row(b)).toBeUndefined();
    expect(f.exchange).not.toHaveBeenCalled();
  });
  it("keeps legacy revoke scoped to its Agent while the remaining Agents retain the root", async () => {
    const f = await sharedMcpFixture(unit.database);
    const [a, b, c] = f.ids as [string, string, string];
    await f.connect(b);
    await f.connect(c);
    await f.auth.revoke(f.accountId, a, f.server.id);
    expect(await f.row(a)).toMatchObject({ status: "revoked", credentialSourceId: null, ciphertext: null });
    expect((await f.row(b))?.id).toBe(f.root.id);
    expect((await f.auth.buildHeaders(f.accountId, c, f.server.id)).authorization).toBe("Bearer old-access");
  });
  it("cancels shared consent from another Agent without clearing a working credential, refresh claim or tools", async () => {
    const f = await sharedMcpFixture(unit.database);
    const [a, b, c] = f.ids as [string, string, string];
    await f.connect(b);
    await f.connect(c);
    const claim = randomUUID();
    await unit.database
      .update(mcpServerAuthorizations)
      .set({ probeState: "succeeded", tools: [{ name: "read" }], toolsCount: 1 })
      .where(eq(mcpServerAuthorizations.mcpServerId, f.server.id));
    await unit.database
      .update(mcpServerAuthorizations)
      .set({ refreshClaimId: claim, refreshClaimedAt: new Date() })
      .where(eq(mcpServerAuthorizations.id, f.root.id));
    await f.start(b);
    const view = (await f.servers.listAuthenticationViews(f.accountId, c))[0];
    await f.auth.cancelSharedFlow(f.accountId, c, f.server.id, f.root.id, view?.authenticationRevision as number);
    expect(await f.row(a)).toMatchObject({
      ciphertext: expect.any(String),
      status: "active",
      state: null,
      refreshClaimId: claim,
      toolsCount: 1,
      probeState: "succeeded",
    });
    expect(await f.row(b)).toMatchObject({ toolsCount: 1, probeState: "succeeded" });
    expect((await f.auth.buildHeaders(f.accountId, c, f.server.id)).authorization).toBe("Bearer old-access");
  });
  it("does not cancel a newer flow using an older authentication revision", async () => {
    const f = await sharedMcpFixture(unit.database);
    const [a, b] = f.ids as [string, string];
    await f.connect(b);
    await f.start(a);
    const old = (await f.servers.listAuthenticationViews(f.accountId, b))[0];
    const state = await f.start(b);
    await expect(
      f.auth.cancelSharedFlow(f.accountId, a, f.server.id, f.root.id, old?.authenticationRevision as number),
    ).rejects.toMatchObject({ code: MCP_ERROR_CODES.OAUTH_FLOW_INVALID });
    expect(await f.flows.callback({ code: "new-flow", state }, SHARED_PROOF)).toMatchObject({ agentId: b });
  });
  it("blocks legacy downgrade for references, versioned credentials and active versioned flows", async () => {
    const f = await sharedMcpFixture(unit.database);
    const a = f.ids[0] as string;
    const b = f.ids[1] as string;
    await f.connect(b);
    await f.start(b);
    expect(await readMcpRolloutStatus(unit.database, f.cipher)).toMatchObject({
      referenceCount: 1,
      versionedCredentialCount: 1,
      versionedFlowCount: 1,
      unreadableEnvelopeCount: 0,
      legacyDowngradeAllowed: false,
    });
    await f.servers.detachAuthorizationFamily(f.accountId, a, f.server.id, f.root.id, 2);
    expect(await readMcpRolloutStatus(unit.database, f.cipher)).toMatchObject({ legacyDowngradeAllowed: true });
  });
  it("requires fresh membership confirmation before disconnecting all", async () => {
    const f = await sharedMcpFixture(unit.database);
    await f.connect(f.ids[1] as string);
    await expect(
      f.servers.detachAuthorizationFamily(f.accountId, f.ids[0] as string, f.server.id, f.root.id, 1),
    ).rejects.toMatchObject({ code: MCP_ERROR_CODES.BINDING_CONFLICT });
    await f.servers.detachAuthorizationFamily(f.accountId, f.ids[0] as string, f.server.id, f.root.id, 2);
    expect(await f.row(f.ids[0] as string)).toBeUndefined();
    expect(await f.row(f.ids[1] as string)).toBeUndefined();
    expect(await unit.database.select().from(agentMcpServers)).toHaveLength(2);
  });
});
