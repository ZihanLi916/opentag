import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabaseClient } from "../../db/client.js";
import { mcpServerAuthorizations, users } from "../../db/schema/index.js";
import { AgentService } from "../../services/agents/agent-service.js";
import { MCP_ERROR_CODES } from "../../services/mcp/errors.js";
import { McpAuthorizationService } from "../../services/mcp/mcp-authorization-service.js";
import type { McpProbeResult } from "../../services/mcp/mcp-probe.js";
import { OnboardingResetService } from "../../services/onboarding-reset/index.js";
import { deferred } from "../support/deferred.js";
import { SHARED_ISSUER, SHARED_PROOF, SHARED_URL, sharedMcpFixture } from "../support/mcp-shared-authorization.js";
import { type MigratedTestDatabase, startMigratedTestDatabase } from "./migrated-test-database.js";

let fixture: MigratedTestDatabase;
let client: ReturnType<typeof createDatabaseClient>;
beforeAll(async () => {
  fixture = await startMigratedTestDatabase();
  client = createDatabaseClient(fixture.databaseUrl);
}, 120000);
afterAll(async () => {
  await client?.sql.end();
  await fixture?.stop();
});
beforeEach(async () => fixture.reset());

describe("shared MCP authentication on PostgreSQL", () => {
  it("admits a new Agent and hands off the holder while one refresh is on the network", async () => {
    const f = await sharedMcpFixture(client.database);
    const [a, b, c] = f.ids as [string, string, string];
    await f.connect(b);
    await f.servers.detachServer(f.accountId, c, f.server.id);
    await client.database
      .update(mcpServerAuthorizations)
      .set({
        tools: [{ name: "b-only", description: null, inputSchema: null }],
        toolsCount: 1,
        probeState: "succeeded",
      })
      .where(eq(mcpServerAuthorizations.agentId, b));
    const sent = deferred();
    const reply = deferred<{ accessToken: string; refreshToken: string; expiresIn: number }>();
    f.refresh.mockImplementation(async () => {
      sent.resolve();
      return reply.promise;
    });
    const refreshing = f.flows.refreshAuthorization(f.root.id);
    try {
      await sent.promise;
      const before = await f.row(a);
      const installation = await f.auth.findReusableInstallation(
        f.accountId,
        c,
        { name: "new-agent", url: SHARED_URL, defaultAuthKind: "oauth" },
        ["read"],
      );
      expect(installation?.id).toBe(f.server.id);
      await f.servers.attachServer(f.accountId, c, installation?.id as string, true);
      await expect(f.connect(c)).resolves.toBe(true);
      await f.servers.detachServer(f.accountId, a, f.server.id);
      const holder = await f.row(b);
      expect(holder).toMatchObject({
        id: f.root.id,
        refreshClaimId: before?.refreshClaimId,
        refreshGeneration: before?.refreshGeneration,
        toolsCount: 1,
        tools: [{ name: "b-only" }],
      });
      expect((await f.servers.listAuthenticationViews(f.accountId, c))[0]?.status).toBe("connected");
    } finally {
      reply.resolve({ accessToken: "rotated", refreshToken: "rotated-refresh", expiresIn: 3600 });
      await refreshing;
    }
    expect((await f.auth.buildHeaders(f.accountId, b, f.server.id)).authorization).toBe("Bearer rotated");
    expect((await f.auth.buildHeaders(f.accountId, c, f.server.id)).authorization).toBe("Bearer rotated");
    const holder = await f.row(b);
    expect(holder?.refreshGeneration).toBe(f.root.refreshGeneration + 1);
    expect(holder?.refreshClaimId).toBeNull();
    expect(f.refresh).toHaveBeenCalledTimes(1);
  });
  it.each(["read", ""])(
    "invalidates every member's tools and fences an old probe when refresh scopes become %j",
    async (scope) => {
      const f = await sharedMcpFixture(client.database);
      const [a, b] = f.ids as [string, string];
      await f.connect(b);
      const tools = [{ name: "write", description: null, inputSchema: null }];
      await client.database
        .update(mcpServerAuthorizations)
        .set({ tools, toolsCount: 1, probeState: "succeeded" })
        .where(eq(mcpServerAuthorizations.mcpServerId, f.server.id));
      await client.database
        .update(mcpServerAuthorizations)
        .set({ scopes: ["read", "write"] })
        .where(eq(mcpServerAuthorizations.id, f.root.id));
      const sent = deferred();
      const reply = deferred<McpProbeResult>();
      const auth = new McpAuthorizationService({
        database: client.database,
        cipher: f.cipher,
        servers: f.servers,
        probe: {
          probe: vi.fn(async () => {
            sent.resolve();
            return reply.promise;
          }),
        } as never,
      });
      const probing = auth.probe(f.accountId, b, f.server.id);
      try {
        await sent.promise;
        f.refresh.mockResolvedValue({ accessToken: "narrower", refreshToken: "rotated", expiresIn: 3600, scope });
        await f.flows.refreshAuthorization(f.root.id);
      } finally {
        reply.resolve({
          probeState: "succeeded",
          protocolEra: "modern",
          protocolVersion: "2026-07-28",
          serverInfo: null,
          capabilities: null,
          instructions: null,
          tools,
          toolsCount: 1,
          toolsTruncated: false,
          toolsSkipped: 0,
          probeError: null,
          eraInvalidated: false,
        });
        await probing;
      }
      expect(await f.row(a)).toMatchObject({
        scopes: scope ? [scope] : [],
        tools: null,
        toolsCount: null,
        probeState: "pending",
      });
      expect(await f.row(b)).toMatchObject({ tools: null, toolsCount: null, probeState: "pending" });
    },
  );
  it("retains tool snapshots when only scope order, duplicates or offline_access changes", async () => {
    const f = await sharedMcpFixture(client.database);
    const [a, b] = f.ids as [string, string];
    await f.connect(b);
    await client.database
      .update(mcpServerAuthorizations)
      .set({ tools: [{ name: "read" }], toolsCount: 1, probeState: "succeeded" })
      .where(eq(mcpServerAuthorizations.mcpServerId, f.server.id));
    await client.database
      .update(mcpServerAuthorizations)
      .set({ scopes: ["read", "write", "offline_access"] })
      .where(eq(mcpServerAuthorizations.id, f.root.id));
    const before = await f.row(b);
    f.refresh.mockResolvedValue({ accessToken: "rotated", expiresIn: 3600, scope: "write read read" });
    await f.flows.refreshAuthorization(f.root.id);
    expect(await f.row(a)).toMatchObject({ toolsCount: 1, probeState: "succeeded" });
    expect(await f.row(b)).toMatchObject({ toolsCount: 1, probeState: "succeeded", revision: before?.revision });
  });
  it("preserves a refresh committed before holder handoff", async () => {
    const f = await sharedMcpFixture(client.database);
    const [a, b] = f.ids as [string, string];
    await f.connect(b);
    await f.flows.refreshAuthorization(f.root.id);
    await f.servers.detachServer(f.accountId, a, f.server.id);
    expect((await f.auth.buildHeaders(f.accountId, b, f.server.id)).authorization).toBe("Bearer new-access");
    expect((await f.row(b))?.id).toBe(f.root.id);
  });
  it("settles a callback on the current holder after the original holder was removed", async () => {
    const f = await sharedMcpFixture(client.database);
    const [a, b] = f.ids as [string, string];
    await f.connect(b);
    const state = await f.start(b);
    const sent = deferred();
    const reply = deferred<{ accessToken: string; expiresIn: number }>();
    f.exchange.mockImplementation(async () => {
      sent.resolve();
      return reply.promise;
    });
    const callback = f.flows.callback({ code: "code", state }, SHARED_PROOF);
    try {
      await sent.promise;
      await f.servers.detachServer(f.accountId, a, f.server.id);
    } finally {
      reply.resolve({ accessToken: "consent-after-handoff", expiresIn: 3600 });
    }
    expect(await callback).toMatchObject({ accountId: f.accountId, agentId: b });
    expect((await f.row(b))?.id).toBe(f.root.id);
    expect((await f.auth.buildHeaders(f.accountId, b, f.server.id)).authorization).toBe("Bearer consent-after-handoff");
  });
  it("redeems an Agent handoff once after the authentication holder has moved", async () => {
    const f = await sharedMcpFixture(client.database);
    const [a, b] = f.ids as [string, string];
    await f.connect(b);
    const started = await f.flows.startWithHandoff(
      f.accountId,
      b,
      f.server.id,
      ["read"],
      "https://opentag.example.test",
      "account",
    );
    const token = new URL(started.authorizationUrl).searchParams.get("token") as string;
    await f.servers.detachServer(f.accountId, a, f.server.id);
    const redeemed = await f.flows.redeemHandoffToken(token, f.accountId);
    await expect(f.flows.redeemHandoffToken(token, f.accountId)).rejects.toMatchObject({
      code: MCP_ERROR_CODES.OAUTH_FLOW_INVALID,
    });
    expect(await f.flows.callback({ code: "handoff", state: started.state }, redeemed.flowSecret)).toMatchObject({
      accountId: f.accountId,
      agentId: b,
    });
    expect((await f.row(b))?.id).toBe(f.root.id);
  });
  it("makes a one-use callback single flight", async () => {
    const f = await sharedMcpFixture(client.database);
    const a = f.ids[0] as string;
    const state = await f.start(a);
    const sent = deferred();
    const reply = deferred<{ accessToken: string; expiresIn: number }>();
    f.exchange.mockImplementation(async () => {
      sent.resolve();
      return reply.promise;
    });
    const first = f.flows.callback({ code: "code", state }, SHARED_PROOF);
    try {
      await sent.promise;
      await expect(f.flows.callback({ code: "code", state }, SHARED_PROOF)).rejects.toMatchObject({
        code: MCP_ERROR_CODES.OAUTH_FLOW_INVALID,
      });
    } finally {
      reply.resolve({ accessToken: "once", expiresIn: 3600 });
      await first;
    }
    expect(f.exchange).toHaveBeenCalledTimes(1);
  });
  it("fences a late refresh after a shared reauthorization", async () => {
    const f = await sharedMcpFixture(client.database);
    const [a, b] = f.ids as [string, string];
    await f.connect(b);
    const sent = deferred();
    const reply = deferred<{ accessToken: string; refreshToken: string; expiresIn: number }>();
    f.refresh.mockImplementation(async () => {
      sent.resolve();
      return reply.promise;
    });
    const refreshing = f.flows.refreshAuthorization(f.root.id);
    try {
      await sent.promise;
      const claim = (await f.row(a))?.refreshClaimId;
      const state = await f.start(b);
      expect((await f.row(a))?.refreshClaimId).toBe(claim);
      await f.flows.callback({ code: "consent", state }, SHARED_PROOF);
    } finally {
      reply.resolve({ accessToken: "obsolete", refreshToken: "obsolete-refresh", expiresIn: 3600 });
      await refreshing;
    }
    expect((await f.auth.buildHeaders(f.accountId, b, f.server.id)).authorization).toBe("Bearer new-consent");
    expect(f.refresh).toHaveBeenCalledTimes(1);
  });
  it("never resurrects a disconnected family from an in-flight refresh", async () => {
    const f = await sharedMcpFixture(client.database);
    const [a, b] = f.ids as [string, string];
    await f.connect(b);
    const sent = deferred();
    const reply = deferred<{ accessToken: string; expiresIn: number }>();
    f.refresh.mockImplementation(async () => {
      sent.resolve();
      return reply.promise;
    });
    const refreshing = f.flows.refreshAuthorization(f.root.id);
    try {
      await sent.promise;
      await f.servers.detachAuthorizationFamily(f.accountId, b, f.server.id, f.root.id, 2);
    } finally {
      reply.resolve({ accessToken: "discarded", expiresIn: 3600 });
      await refreshing;
    }
    expect(await f.row(a)).toBeUndefined();
    expect(await f.row(b)).toBeUndefined();
  });
  it("does not replay a stale refresh claim or expose a refresh token", async () => {
    const f = await sharedMcpFixture(client.database);
    const [a, b] = f.ids as [string, string];
    await f.connect(b);
    await client.database
      .update(mcpServerAuthorizations)
      .set({ refreshClaimId: randomUUID(), refreshClaimedAt: new Date(Date.now() - 180000) })
      .where(eq(mcpServerAuthorizations.id, f.root.id));
    await f.flows.refreshAuthorization(f.root.id);
    await f.flows.refreshAuthorization(f.root.id);
    expect(f.refresh).not.toHaveBeenCalled();
    expect(await f.row(a)).toMatchObject({
      ciphertext: null,
      keyId: null,
      status: "error",
      failureCode: MCP_ERROR_CODES.REFRESH_OUTCOME_UNKNOWN,
    });
    expect((await f.servers.listAuthenticationViews(f.accountId, b))[0]?.status).toBe("authorization_required");
  });
  it("transfers only the departing Agent and retains the root for its original Account", async () => {
    const f = await sharedMcpFixture(client.database);
    const [a, b] = f.ids as [string, string];
    await f.connect(b);
    const target = randomUUID();
    await client.database.insert(users).values({ id: target, email: `${target}@example.test`, displayName: "Target" });
    await new AgentService(client.database, { mcpCredentialCipher: f.cipher }).transferToAccount({
      agentId: a,
      targetAccountId: target,
      slack: "disable",
    });
    expect((await f.row(b))?.id).toBe(f.root.id);
    expect((await f.auth.buildHeaders(f.accountId, b, f.server.id)).authorization).toBe("Bearer old-access");
    await expect(f.auth.buildHeaders(target, a, f.server.id)).rejects.toMatchObject({
      code: MCP_ERROR_CODES.BINDING_NOT_FOUND,
    });
  });
  it("hands off a suspended Agent's shared root during deletion", async () => {
    const f = await sharedMcpFixture(client.database);
    const [a, b] = f.ids as [string, string];
    await f.connect(b);
    await new AgentService(client.database, { mcpCredentialCipher: f.cipher }).deleteById(f.accountId, a);
    expect((await f.row(b))?.id).toBe(f.root.id);
    expect((await f.auth.buildHeaders(f.accountId, b, f.server.id)).authorization).toBe("Bearer old-access");
  });
  it("clears a complete shared family through onboarding reset", async () => {
    const f = await sharedMcpFixture(client.database);
    await f.connect(f.ids[1] as string);
    const agents = new AgentService(client.database, { mcpCredentialCipher: f.cipher });
    await new OnboardingResetService({ database: client.database, agents, environment: "staging" }).resetOnboarding(
      f.accountId,
    );
    expect(await f.row(f.ids[0] as string)).toBeUndefined();
    expect(await f.row(f.ids[1] as string)).toBeUndefined();
  });
  it("moves a still-pending PKCE flow before its callback begins", async () => {
    const f = await sharedMcpFixture(client.database);
    const [a, b] = f.ids as [string, string];
    await f.connect(b);
    const state = await f.start(a);
    await f.servers.detachServer(f.accountId, a, f.server.id);
    await f.flows.callback({ code: "code", state }, SHARED_PROOF);
    expect((await f.auth.buildHeaders(f.accountId, b, f.server.id)).authorization).toBe("Bearer new-consent");
    const row = await f.row(b);
    expect(row?.authorizationServer).toBe(SHARED_ISSUER);
    expect(row?.state).toBeNull();
  });
});
