import type { AgentSchedule, AgentScheduleListItem } from "@opentag/shared/browser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, browserApi } from "../../api.js";
import { AgentSchedulesSection, formatScheduleTime } from "./agent-schedules-section.js";

const AGENT_ID = "10c4a3b9-1631-4e4b-8922-23932ea36237";
const SCHEDULE_ID = "5238c0ee-a939-4bc0-8772-66d46c9df934";
const TARGET_ID = "2af661c1-f3d9-4c8e-9e9b-e31c49f298ce";
const TIME = "2026-09-28T01:00:00.000Z";

function schedule(overrides: Partial<AgentSchedule> = {}): AgentSchedule {
  return {
    id: SCHEDULE_ID,
    agentId: AGENT_ID,
    target: {
      sessionId: TARGET_ID,
      provider: "feishu",
      sessionKind: "thread",
      channelId: "test-chat",
      threadKey: "test-thread",
    },
    name: "Daily check",
    prompt: "Check the build and include END-OF-TASK in the result.",
    schedule: { kind: "every", intervalSeconds: 60, anchorAt: TIME },
    timezone: "Asia/Shanghai",
    enabled: true,
    nextTriggerAt: "2026-09-28T01:01:00.000Z",
    revision: 3,
    lastDispatch: null,
    detailUrl: `https://example.com/agents/${AGENT_ID}?schedule=${SCHEDULE_ID}`,
    createdAt: TIME,
    updatedAt: TIME,
    ...overrides,
  };
}

function summaryOf(full: AgentSchedule): AgentScheduleListItem {
  const { prompt: _prompt, detailUrl: _detailUrl, ...summary } = full;
  return summary;
}

function mount(scheduleId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AgentSchedulesSection agentId={AGENT_ID} scheduleId={scheduleId} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("AgentSchedulesSection", () => {
  it.each([
    ["accepted", "Received by the runtime"],
    ["unreachable", "Runtime unreachable"],
    ["rejected", "Rejected by the runtime"],
    ["unknown", "Handoff result unknown"],
    ["skipped", "Skipped"],
  ] as const)("shows the latest %s handoff before details are opened", async (outcome, label) => {
    const item = schedule({
      lastDispatch: { scheduledFor: TIME, attemptedAt: null, messageId: null, outcome, code: null },
    });
    vi.spyOn(browserApi, "agentSchedules").mockResolvedValue({ items: [summaryOf(item)], nextCursor: null });
    const detail = vi.spyOn(browserApi, "agentSchedule").mockResolvedValue(item);

    mount();
    expect(await screen.findByText(`Latest handoff: ${label}`)).toBeTruthy();
    expect(screen.getByTitle(formatScheduleTime(TIME, item.timezone))).toBeTruthy();
    expect(screen.getByText("Enabled")).toBeTruthy();
    expect(screen.queryByText(item.prompt)).toBeNull();
    expect(detail).not.toHaveBeenCalled();
  });

  it.each([
    [
      "accepted",
      "The runtime received this occurrence. This does not confirm task completion; check Tasks for progress and results.",
    ],
    ["unreachable", "This occurrence could not reach the runtime. Check the Agent’s Computer status."],
    ["rejected", "The runtime did not accept this occurrence. Check the reason code and the Agent’s Computer status."],
    [
      "unknown",
      "The handoff has not been confirmed yet. The task may have started; check Tasks before starting it again.",
    ],
    ["skipped", "This occurrence was skipped. See the reason code."],
  ] as const)("explains %s without claiming the business task completed", async (outcome, explanation) => {
    const item = schedule({
      lastDispatch: { scheduledFor: TIME, attemptedAt: TIME, messageId: null, outcome, code: "runtime_not_ready" },
    });
    vi.spyOn(browserApi, "agentSchedules").mockResolvedValue({ items: [summaryOf(item)], nextCursor: null });
    vi.spyOn(browserApi, "agentSchedule").mockResolvedValue(item);

    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Daily check" }));
    expect(await screen.findByText(explanation)).toBeTruthy();
    expect(screen.getByText("runtime_not_ready")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText("Next scheduled time", { exact: true })).toBeTruthy();
    expect(screen.queryByText("The schedule will not retry this occurrence.") !== null).toBe(outcome !== "accepted");
  });

  it.each(["unreachable", "rejected"] as const)(
    "explains an exhausted one-time %s handoff without implying another occurrence",
    async (outcome) => {
      const item = schedule({
        schedule: { kind: "at", at: TIME },
        nextTriggerAt: null,
        lastDispatch: { scheduledFor: TIME, attemptedAt: TIME, messageId: null, outcome, code: "runtime_not_ready" },
      });
      vi.spyOn(browserApi, "agentSchedules").mockResolvedValue({ items: [summaryOf(item)], nextCursor: null });
      vi.spyOn(browserApi, "agentSchedule").mockResolvedValue(item);

      mount();
      expect(await screen.findByText("One-time schedule exhausted")).toBeTruthy();
      expect(
        screen.getByText(
          `Latest handoff: ${outcome === "unreachable" ? "Runtime unreachable" : "Rejected by the runtime"}`,
        ),
      ).toBeTruthy();
      expect(screen.queryByText("Enabled")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Daily check" }));
      expect(await screen.findByText("The schedule will not retry this occurrence.")).toBeTruthy();
      expect(screen.getByText("runtime_not_ready")).toBeTruthy();
      expect(screen.queryByText(/before the next scheduled time|Future occurrences/)).toBeNull();
    },
  );

  it("keeps a past failed handoff visible when the schedule is paused", async () => {
    const item = schedule({
      enabled: false,
      nextTriggerAt: null,
      lastDispatch: { scheduledFor: TIME, attemptedAt: null, messageId: null, outcome: "unreachable", code: null },
    });
    vi.spyOn(browserApi, "agentSchedules").mockResolvedValue({ items: [summaryOf(item)], nextCursor: null });
    mount();
    expect(await screen.findByText("Paused")).toBeTruthy();
    expect(screen.getByText("Latest handoff: Runtime unreachable")).toBeTruthy();
    expect(screen.queryByText(/Next scheduled time/)).toBeNull();
  });

  it("keeps the full task behind the Account detail read", async () => {
    const item = schedule();
    vi.spyOn(browserApi, "agentSchedules").mockResolvedValue({ items: [summaryOf(item)], nextCursor: null });
    const detail = vi.spyOn(browserApi, "agentSchedule").mockResolvedValue(item);

    mount();
    expect(await screen.findByText("Daily check")).toBeTruthy();
    expect(screen.queryByText(item.prompt)).toBeNull();
    expect(detail).not.toHaveBeenCalled();
    expect(screen.queryByText(/Latest handoff:/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Daily check" }));
    expect(await screen.findByText(item.prompt)).toBeTruthy();
    expect(screen.getByText(/feishu channel test-chat, thread test-thread/)).toBeTruthy();
    expect(detail).toHaveBeenCalledWith(AGENT_ID, SCHEDULE_ID);
  });

  it("opens a deep-linked schedule even when it is outside the loaded page", async () => {
    const item = schedule();
    vi.spyOn(browserApi, "agentSchedules").mockResolvedValue({ items: [], nextCursor: null });
    vi.spyOn(browserApi, "agentSchedule").mockResolvedValue(item);

    mount(SCHEDULE_ID);
    expect(await screen.findByText(item.prompt)).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Daily check" })).toBeTruthy();
  });

  it("shows an inaccessible old deep link without leaking task content", async () => {
    vi.spyOn(browserApi, "agentSchedules").mockResolvedValue({ items: [], nextCursor: null });
    vi.spyOn(browserApi, "agentSchedule").mockRejectedValue(new ApiError(404, "Not found"));

    mount(SCHEDULE_ID);
    expect(await screen.findByText("This schedule no longer exists or is not accessible.")).toBeTruthy();
    expect(screen.queryByText("Full task")).toBeNull();
  });

  it("uses the observed revision for pause and delete", async () => {
    const current = schedule();
    const paused = schedule({ enabled: false, nextTriggerAt: null, revision: 4 });
    vi.spyOn(browserApi, "agentSchedules")
      .mockResolvedValueOnce({ items: [summaryOf(current)], nextCursor: null })
      .mockResolvedValue({ items: [summaryOf(paused)], nextCursor: null });
    vi.spyOn(browserApi, "agentSchedule").mockResolvedValue(paused);
    const pause = vi.spyOn(browserApi, "pauseAgentSchedule").mockResolvedValue(paused);
    const remove = vi.spyOn(browserApi, "deleteAgentSchedule").mockResolvedValue(undefined);

    mount();
    expect(await screen.findByText("Daily check")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Actions for Daily check" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Pause" }));
    await waitFor(() => expect(pause).toHaveBeenCalledWith(AGENT_ID, SCHEDULE_ID, 3));
    expect(await screen.findByText("Paused")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Actions for Daily check" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(AGENT_ID, SCHEDULE_ID, 4));
  });

  it("retries a failed first read without claiming the list is empty", async () => {
    const item = schedule();
    vi.spyOn(browserApi, "agentSchedules")
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValue({ items: [summaryOf(item)], nextCursor: null });
    mount();
    expect(await screen.findByText("Schedules could not be loaded.")).toBeTruthy();
    expect(screen.queryByText("No schedules for this Agent yet.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Daily check" })).toBeTruthy();
  });

  it("loads the next summary page without fetching either private task", async () => {
    const first = schedule();
    const second = schedule({ id: "next-page-schedule", name: "Weekly review" });
    const list = vi
      .spyOn(browserApi, "agentSchedules")
      .mockResolvedValueOnce({ items: [summaryOf(first)], nextCursor: "page-2" })
      .mockResolvedValue({ items: [summaryOf(second)], nextCursor: null });
    const detail = vi.spyOn(browserApi, "agentSchedule");
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    expect(await screen.findByRole("button", { name: "Weekly review" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Daily check" })).toBeTruthy();
    expect(list).toHaveBeenLastCalledWith(AGENT_ID, { cursor: "page-2" });
    expect(detail).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("preserves loaded summaries and offers recovery when the next page fails", async () => {
    vi.spyOn(browserApi, "agentSchedules")
      .mockResolvedValueOnce({ items: [summaryOf(schedule())], nextCursor: "page-2" })
      .mockRejectedValue(new Error("Unavailable"));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Schedules could not be loaded.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Daily check" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("prevents overlapping mutations while keeping summary details available", async () => {
    const current = schedule();
    const paused = schedule({ enabled: false, nextTriggerAt: null, revision: 4 });
    const second = schedule({ id: "second", name: "Weekly review" });
    let finish!: (item: AgentSchedule) => void;
    const pause = vi.spyOn(browserApi, "pauseAgentSchedule").mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    vi.spyOn(browserApi, "agentSchedules")
      .mockResolvedValueOnce({ items: [summaryOf(current), summaryOf(second)], nextCursor: null })
      .mockResolvedValue({ items: [summaryOf(paused), summaryOf(second)], nextCursor: null });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Daily check" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Pause" }));
    expect((screen.getByRole("button", { name: "Actions for Weekly review" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: "Daily check" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Actions for Weekly review" }));
    expect(pause).toHaveBeenCalledOnce();
    await act(async () => finish(paused));
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Actions for Weekly review" }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
  });

  it("keeps a refused delete open, defaults to Cancel and restores the menu trigger", async () => {
    vi.spyOn(browserApi, "agentSchedules").mockResolvedValue({ items: [summaryOf(schedule())], nextCursor: null });
    vi.spyOn(browserApi, "deleteAgentSchedule").mockRejectedValue(new Error("Conflict"));
    mount();
    const trigger = await screen.findByRole("button", { name: "Actions for Daily check" });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog");
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await within(dialog).findByRole("alert")).toBeTruthy();
    fireEvent.click(cancel);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Daily check" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("refreshes a conflicted deletion and uses the new observed revision on explicit retry", async () => {
    const updated = schedule({ revision: 4, enabled: false, nextTriggerAt: null, name: "Updated check" });
    vi.spyOn(browserApi, "agentSchedules")
      .mockResolvedValueOnce({ items: [summaryOf(schedule())], nextCursor: null })
      .mockResolvedValueOnce({ items: [summaryOf(updated)], nextCursor: null })
      .mockResolvedValue({ items: [], nextCursor: null });
    const details = vi.spyOn(browserApi, "agentSchedule");
    const remove = vi
      .spyOn(browserApi, "deleteAgentSchedule")
      .mockRejectedValueOnce(new ApiError(409, "Revision conflict"))
      .mockResolvedValue(undefined);
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Daily check" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Updated check" });
    expect(within(dialog).getByRole("alert").textContent).toContain("This schedule changed");
    const confirm = within(dialog).getByRole("button", { name: "Delete" });
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    expect(remove).toHaveBeenCalledExactlyOnceWith(AGENT_ID, SCHEDULE_ID, 3);
    expect(details).not.toHaveBeenCalled();
    fireEvent.click(confirm);
    await waitFor(() => expect(remove).toHaveBeenLastCalledWith(AGENT_ID, SCHEDULE_ID, 4));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("closes a conflicted deletion if the refreshed list no longer contains its target", async () => {
    vi.spyOn(browserApi, "agentSchedules")
      .mockResolvedValueOnce({ items: [summaryOf(schedule())], nextCursor: null })
      .mockResolvedValue({ items: [], nextCursor: null });
    const remove = vi.spyOn(browserApi, "deleteAgentSchedule").mockRejectedValue(new ApiError(409, "Conflict"));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Daily check" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Schedules" })));
    expect(remove).toHaveBeenCalledOnce();
  });

  it("blocks deletion after a failed refresh until an explicit read recovers the latest revision", async () => {
    const updated = schedule({ revision: 5 });
    const list = vi
      .spyOn(browserApi, "agentSchedules")
      .mockResolvedValueOnce({ items: [summaryOf(schedule())], nextCursor: null })
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue({ items: [summaryOf(updated)], nextCursor: null });
    const remove = vi.spyOn(browserApi, "deleteAgentSchedule").mockRejectedValue(new ApiError(409, "Conflict"));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Daily check" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete" });
    fireEvent.click(confirm);
    const retry = await within(dialog).findByRole("button", { name: "Retry" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm);
    expect(remove).toHaveBeenCalledOnce();
    fireEvent.click(retry);
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    expect(list).toHaveBeenCalledTimes(3);
    fireEvent.click(confirm);
    await waitFor(() => expect(remove).toHaveBeenLastCalledWith(AGENT_ID, SCHEDULE_ID, 5));
  });

  it("returns focus to the section after deleting its last schedule", async () => {
    vi.spyOn(browserApi, "agentSchedules")
      .mockResolvedValueOnce({ items: [summaryOf(schedule())], nextCursor: null })
      .mockResolvedValue({ items: [], nextCursor: null });
    vi.spyOn(browserApi, "deleteAgentSchedule").mockResolvedValue(undefined);
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Daily check" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Schedules" })));
    expect(screen.queryByRole("button", { name: "Daily check" })).toBeNull();
  });

  it("closes a private detail when switching Agents and ignores its late result", async () => {
    const item = schedule();
    let finish!: (item: AgentSchedule) => void;
    vi.spyOn(browserApi, "agentSchedules").mockImplementation(async (id) => ({
      items: id === AGENT_ID ? [summaryOf(item)] : [],
      nextCursor: null,
    }));
    vi.spyOn(browserApi, "agentSchedule").mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={client}>
        <AgentSchedulesSection agentId={AGENT_ID} />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Daily check" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    view.rerender(
      <QueryClientProvider client={client}>
        <AgentSchedulesSection agentId="another-agent" />
      </QueryClientProvider>,
    );
    await act(async () => finish(item));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(item.prompt)).toBeNull();
  });

  it.each([
    ["30 9 * * 1-5", "Weekdays at 9:30 AM"],
    ["0 18 * * *", "Daily at 6:00 PM"],
    ["0 9 * * 1", "Every Monday at 9:00 AM"],
    ["0 9 1 * 1", "Cron: 0 9 1 * 1"],
    ["*/15 9-17 * * 1-5", "Cron: */15 9-17 * * 1-5"],
  ])("describes %s without guessing complex cron semantics", async (expression, label) => {
    const item = schedule({ schedule: { kind: "cron", expression } });
    vi.spyOn(browserApi, "agentSchedules").mockResolvedValue({ items: [summaryOf(item)], nextCursor: null });
    vi.spyOn(browserApi, "agentSchedule").mockResolvedValue(item);
    mount();
    expect(
      await screen.findByText((_, element) => element?.tagName === "P" && element.textContent === `Enabled · ${label}`),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Daily check" }));
    expect(await within(screen.getByRole("dialog")).findByText(`Cron: ${expression}`)).toBeTruthy();
  });
});
