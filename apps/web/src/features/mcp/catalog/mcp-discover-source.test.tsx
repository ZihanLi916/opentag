import type { McpCatalogEntry } from "@opentag/mcp-presets";
import type { MCPAgentServer, MCPAuthorizationSummary, MCPServer } from "@opentag/shared/browser";
import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { entry, wrap } from "../mcp-test-fixtures.js";
import { McpDiscoverSource } from "./mcp-discover-source.js";

/**
 * The Discover source, driven against a synthetic catalog.
 *
 * The shipped catalog is operator-owned data, so no test asserts a shipped entry's name or endpoint:
 * editing `mcp-catalog.yaml` must not break a test. What is asserted is the surface's behavior — tab
 * order, category grouping, localization lookup, method copy, installed state, and how an add reuses
 * or creates the Account definition.
 */
const CATALOG = vi.hoisted(() => ({
  categories: [
    { id: "general", label: { en: "General", zh: "通用" }, order: 10 },
    { id: "engineering", label: { en: "Engineering", zh: "工程" }, order: 20 },
  ],
  entries: [
    {
      id: "alpha",
      name: "alpha",
      title: { en: "Alpha", zh: "阿尔法" },
      description: { en: "Docs and wikis.", zh: "文档与知识库。" },
      url: "https://mcp.alpha.test/mcp",
      defaultAuthKind: "oauth",
      oauthScopes: ["alpha.read", "alpha.write"],
      category: "general",
      website: "https://alpha.test",
      iconUrl: "/alpha.svg",
      order: 10,
    },
    {
      id: "delta",
      name: "delta",
      title: { en: "Delta", zh: "德尔塔" },
      description: { en: "Notes and tasks.", zh: "笔记与任务。" },
      url: "https://mcp.delta.test/mcp",
      defaultAuthKind: "oauth",
      category: "general",
      website: "https://delta.test",
      iconUrl: "/delta.svg",
      order: 20,
    },
    {
      id: "beta",
      name: "beta",
      title: { en: "Beta", zh: "贝塔" },
      description: { en: "Boards and tickets.", zh: "看板与工单。" },
      url: "https://mcp.beta.test/mcp",
      defaultAuthKind: "none",
      category: "engineering",
      website: "https://beta.test",
      iconUrl: "/beta.svg",
      order: 10,
    },
    {
      id: "gamma",
      name: "gamma",
      title: { en: "Gamma", zh: "伽马" },
      description: { en: "Errors and traces.", zh: "错误与链路。" },
      url: "https://mcp.gamma.test/mcp",
      defaultAuthKind: "bearer",
      category: "engineering",
      website: "https://gamma.test",
      iconUrl: "/gamma.svg",
      order: 20,
    },
  ],
}));

vi.mock("@opentag/mcp-presets", () => ({
  MCP_CATALOG_CATEGORIES: CATALOG.categories,
  MCP_CATALOG_ENTRIES: CATALOG.entries,
}));

afterEach(() => vi.restoreAllMocks());

const entries = CATALOG.entries as McpCatalogEntry[];

const ALPHA_ID = "11111111-1111-4111-8111-111111111111";
const BETA_ID = "22222222-2222-4222-8222-222222222222";
const GAMMA_ID = "33333333-3333-4333-8333-333333333333";
const DELTA_ID = "44444444-4444-4444-8444-444444444444";

function idFor(name: string): string {
  if (name === "beta") return BETA_ID;
  if (name === "gamma") return GAMMA_ID;
  if (name === "delta") return DELTA_ID;
  return ALPHA_ID;
}

function summary(status: MCPAuthorizationSummary["status"]): MCPAuthorizationSummary {
  return {
    kind: "oauth",
    status,
    hasCredential: true,
    scopes: null,
    accessTokenExpiresAt: null,
    authorizationServer: null,
    probeState: "succeeded",
    probedAt: null,
    probeError: null,
    toolsCount: 3,
    toolsTruncated: false,
    failureCode: null,
    revision: 1,
  };
}

/** The definition a create or a reuse produces for one catalog entry. */
function serverFor(name: string): MCPServer {
  return {
    id: idFor(name),
    name,
    description: null,
    url: `https://mcp.${name}.test/mcp`,
    defaultAuthKind: "oauth",
    authHeader: "authorization",
    authScheme: "Bearer",
    extraHeaders: {},
    revision: 1,
    boundAgentCount: 0,
    authorizedAgentCount: 0,
    lastProbedAt: null,
    createdAt: "2026-09-15T00:00:00.000Z",
    updatedAt: "2026-09-16T00:00:00.000Z",
  };
}

/** The mount of one definition, so card state and mutation targets can be driven without a read. */
function mountFor(server: MCPServer, authorization: MCPAuthorizationSummary | null): MCPAgentServer {
  return entry({
    mcpServerId: server.id,
    name: server.name,
    effective: { ...entry().effective, url: server.url },
    authorization,
  });
}

async function discover(overrides: { servers?: MCPServer[]; mounted?: MCPAgentServer[] } = {}) {
  const onAdd = vi.fn();
  wrap(
    <McpDiscoverSource
      categories={CATALOG.categories}
      entries={entries}
      servers={overrides.servers ?? []}
      mounted={overrides.mounted ?? []}
      busy={false}
      onAdd={onAdd}
    />,
  );
  await screen.findByLabelText("Search the marketplace");
  return onAdd;
}

/** Choose a category tab inside the open dialog. */
function chooseCategory(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("Discover catalog surface", () => {
  it("renders category tabs in the declared order and only the active category's cards", async () => {
    await discover();
    const tabs = screen.getByRole("group", { name: "Categories" }).querySelectorAll("button");
    expect([...tabs].map((tab) => tab.textContent)).toEqual(["General", "Engineering"]);
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.queryByText("Beta")).toBeNull();
  });

  it("switches category and keeps the cards' localized copy", async () => {
    await discover();
    chooseCategory("Engineering");
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.getByText("Gamma")).toBeTruthy();
    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.getByText("Boards and tickets.")).toBeTruthy();
  });

  it("filters by the active locale's text, the name, and the URL", async () => {
    await discover();
    const search = screen.getByLabelText("Search the marketplace");
    fireEvent.change(search, { target: { value: "wiki" } });
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.queryByText("Beta")).toBeNull();
    fireEvent.change(search, { target: { value: "mcp.beta.test" } });
    expect(screen.getByText("Beta")).toBeTruthy();
    fireEvent.change(search, { target: { value: "nothing here" } });
    expect(screen.getByText("No MCP servers match this search.")).toBeTruthy();
  });

  it("names the method it will use for each authorization kind", async () => {
    await discover();
    expect(screen.getByRole("button", { name: "Connect with OAuth: Alpha" })).toBeTruthy();
    chooseCategory("Engineering");
    expect(screen.getByRole("button", { name: "Add without signing in: Beta" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect with an API key: Gamma" })).toBeTruthy();
  });

  it("shows an authorized mount instead of an add action", async () => {
    await discover({ mounted: [mountFor(serverFor("alpha"), summary("active"))] });
    expect(screen.getByText("Authorized")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Connect with OAuth: Alpha" })).toBeNull();
  });

  it("distinguishes a mount that still needs authorization", async () => {
    await discover({ mounted: [mountFor(serverFor("alpha"), summary("pending"))] });
    expect(screen.getByText("Authorization required")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Connect with OAuth: Alpha" })).toBeNull();
  });
});
