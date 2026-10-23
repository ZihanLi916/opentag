import type {
  AgentSchedule,
  AgentScheduleListItem,
  AgentScheduleListResponse,
  AgentScheduleRule,
} from "@opentag/shared/browser";
import { type InfiniteData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, browserApi } from "../../api.js";
import { intlLocale } from "../../i18n/locale.js";
import * as m from "../../paraglide/messages.js";
import { queryKeys } from "../../query/keys.js";
import { Banner, Button, Dialog, DropdownMenu, Icon, SkeletonLine, Text } from "../../ui/design-system.js";

/** Account management for schedules pinned to this Agent's existing IM conversations. */
export function AgentSchedulesSection({ agentId, scheduleId }: { agentId: string; scheduleId?: string }) {
  return <AgentSchedulesContent key={agentId} agentId={agentId} scheduleId={scheduleId} />;
}

function AgentSchedulesContent({ agentId, scheduleId }: { agentId: string; scheduleId?: string }) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.agents.schedules(agentId);
  const [expandedId, setExpandedId] = useState<string | undefined>(scheduleId);
  const [deleteTarget, setDeleteTarget] = useState<AgentScheduleListItem | undefined>();
  const [pendingId, setPendingId] = useState<string | undefined>();
  const [mutationError, setMutationError] = useState<string | undefined>();
  const detailReturnFocus = useRef<HTMLElement | null>(null);
  const deleteReturnFocus = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mutationInFlight = useRef(false);

  useEffect(() => setExpandedId(scheduleId), [scheduleId]);

  const list = useInfiniteQuery({
    queryKey: listKey,
    queryFn: ({ pageParam }) => browserApi.agentSchedules(agentId, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 30_000,
  });
  const detail = useQuery({
    queryKey: queryKeys.agents.schedule(agentId, expandedId ?? ""),
    queryFn: () => browserApi.agentSchedule(agentId, expandedId as string),
    enabled: expandedId !== undefined,
    staleTime: 30_000,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
  const loaded = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const deepLinkedItem =
    expandedId && detail.data && !loaded.some((item) => item.id === expandedId) ? detail.data : undefined;
  const rows = deepLinkedItem ? [deepLinkedItem, ...loaded] : loaded;
  const selectedItem = rows.find((item) => item.id === expandedId);

  async function changeSchedule(item: AgentScheduleListItem, operation: "pause" | "resume") {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setMutationError(undefined);
    setPendingId(item.id);
    try {
      const updated =
        operation === "pause"
          ? await browserApi.pauseAgentSchedule(agentId, item.id, item.revision)
          : await browserApi.resumeAgentSchedule(agentId, item.id, item.revision);
      queryClient.setQueryData(queryKeys.agents.schedule(agentId, item.id), updated);
      queryClient.setQueryData<InfiniteData<AgentScheduleListResponse>>(listKey, (current) =>
        current
          ? {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                items: page.items.map((row) => (row.id === item.id ? summaryOf(updated) : row)),
              })),
            }
          : current,
      );
      await queryClient.invalidateQueries({ queryKey: listKey });
    } catch {
      setMutationError(m.agents_schedules_mutation_error());
      await queryClient.invalidateQueries({ queryKey: listKey });
      await queryClient.invalidateQueries({ queryKey: queryKeys.agents.schedule(agentId, item.id) });
    } finally {
      mutationInFlight.current = false;
      setPendingId(undefined);
    }
  }

  async function deleteSchedule() {
    const item = deleteTarget;
    if (!item || mutationInFlight.current) return;
    mutationInFlight.current = true;
    setMutationError(undefined);
    setPendingId(item.id);
    try {
      await browserApi.deleteAgentSchedule(agentId, item.id, item.revision);
      queryClient.setQueryData<InfiniteData<AgentScheduleListResponse>>(listKey, (current) =>
        current
          ? {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                items: page.items.filter((row) => row.id !== item.id),
              })),
            }
          : current,
      );
      queryClient.removeQueries({ queryKey: queryKeys.agents.schedule(agentId, item.id) });
      if (expandedId === item.id) setExpandedId(undefined);
      deleteReturnFocus.current = headingRef.current;
      setDeleteTarget(undefined);
      await queryClient.invalidateQueries({ queryKey: listKey });
    } catch {
      setMutationError(m.agents_schedules_mutation_error());
      await queryClient.invalidateQueries({ queryKey: listKey });
      await queryClient.invalidateQueries({ queryKey: queryKeys.agents.schedule(agentId, item.id) });
    } finally {
      mutationInFlight.current = false;
      setPendingId(undefined);
    }
  }

  return (
    <section
      className="grid gap-4 ui-surface bg-kumo-base p-6 max-[640px]:p-5 ring ring-kumo-line"
      aria-label={m.agents_schedules_title()}
    >
      <ScheduleHeader headingRef={headingRef} count={rows.length} hasMore={Boolean(list.hasNextPage)} />
      {mutationError && !deleteTarget ? (
        <Banner variant="error" role="alert">
          {mutationError}
        </Banner>
      ) : null}
      <ScheduleListState
        pending={list.isPending}
        error={list.isError}
        hasRows={rows.length > 0}
        showEmpty={expandedId === undefined}
        onRetry={() => void list.refetch()}
      />
      <ScheduleList
        rows={rows}
        pendingId={pendingId}
        onOpen={(id, trigger) => {
          detailReturnFocus.current = trigger;
          setExpandedId(id);
        }}
        onChange={(item) => void changeSchedule(item, item.enabled ? "pause" : "resume")}
        onDelete={(item, trigger) => {
          setMutationError(undefined);
          deleteReturnFocus.current = trigger;
          setDeleteTarget(item);
        }}
      />
      <Dialog
        className="sm:w-[min(42rem,calc(100vw-2rem))]"
        open={expandedId !== undefined}
        title={selectedItem?.name ?? m.agents_schedules_title()}
        onClose={() => {
          if (!detailReturnFocus.current?.isConnected) detailReturnFocus.current = headingRef.current;
          setExpandedId(undefined);
        }}
        returnFocusRef={detailReturnFocus}
      >
        <ScheduleRowDetails detail={detail} onRetry={() => void detail.refetch()} />
      </Dialog>
      {list.hasNextPage ? (
        <Button
          disabled={list.isFetchingNextPage}
          loading={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
          size="compact"
          variant="secondary"
        >
          {m.agents_schedules_load_more()}
        </Button>
      ) : null}
      <ScheduleDeleteDialog
        item={deleteTarget}
        busy={deleteTarget !== undefined && pendingId === deleteTarget.id}
        error={mutationError}
        returnFocusRef={deleteReturnFocus}
        onClose={() => {
          setMutationError(undefined);
          setDeleteTarget(undefined);
        }}
        onConfirm={() => void deleteSchedule()}
      />
    </section>
  );
}

function ScheduleListState({
  pending,
  error,
  hasRows,
  showEmpty,
  onRetry,
}: {
  pending: boolean;
  error: boolean;
  hasRows: boolean;
  showEmpty: boolean;
  onRetry: () => void;
}) {
  if (pending && !hasRows) return <ScheduleLoading />;
  if (error)
    return hasRows ? (
      <Banner
        variant="alert"
        role="status"
        description={m.agents_schedules_list_error()}
        action={<Banner.Action onClick={onRetry}>{m.common_retry()}</Banner.Action>}
      />
    ) : (
      <div className="grid justify-items-start gap-2">
        <p className="text-sm text-kumo-subtle">{m.agents_schedules_list_error()}</p>
        <Button onClick={onRetry} size="compact" variant="secondary">
          {m.common_retry()}
        </Button>
      </div>
    );
  if (hasRows || !showEmpty) return null;
  return (
    <div className="grid justify-items-center gap-2 py-8 text-center">
      <Icon name="tasks" className="mb-2 size-8 text-kumo-subtle" />
      <p className="text-sm font-medium text-kumo-strong">{m.agents_schedules_empty()}</p>
      <p className="max-w-sm text-sm text-kumo-subtle">{m.agents_schedules_empty_hint()}</p>
    </div>
  );
}

function ScheduleHeader({
  headingRef,
  count,
  hasMore,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  count: number;
  hasMore: boolean;
}) {
  return (
    <header className="flex items-center justify-between gap-4">
      <Text as="h2" ref={headingRef} tabIndex={-1} size="lg" variant="heading">
        {m.agents_schedules_title()}
      </Text>
      {count ? (
        <span className="text-sm tabular-nums text-kumo-subtle">
          {count}
          {hasMore ? "+" : ""}
        </span>
      ) : null}
    </header>
  );
}

interface ScheduleListProps {
  rows: AgentScheduleListItem[];
  pendingId?: string;
  onOpen: (id: string, trigger: HTMLElement) => void;
  onChange: (item: AgentScheduleListItem) => void;
  onDelete: (item: AgentScheduleListItem, trigger: HTMLElement | null) => void;
}

function ScheduleList(props: ScheduleListProps) {
  if (props.rows.length === 0) return null;
  return (
    <ul className="grid list-none divide-y divide-kumo-line">
      {props.rows.map((item) => (
        <ScheduleRow key={item.id} item={item} {...props} />
      ))}
    </ul>
  );
}

function ScheduleRow({
  item,
  pendingId,
  onOpen,
  onChange,
  onDelete,
}: ScheduleListProps & {
  item: AgentScheduleListItem;
}) {
  const actionTrigger = useRef<HTMLButtonElement>(null);
  const wasPending = useRef(false);
  const pending = pendingId === item.id;
  useEffect(() => {
    if (!pending && wasPending.current && document.activeElement === document.body) actionTrigger.current?.focus();
    wasPending.current = pending;
  }, [pending]);
  return (
    <li
      aria-busy={pending}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 py-5 first:pt-0 last:pb-0 @min-[42rem]/content:grid-cols-[minmax(0,1fr)_minmax(10rem,auto)_auto]"
    >
      <div className="grid min-w-0 gap-2">
        <Button
          variant="ghost"
          size="compact"
          aria-haspopup="dialog"
          onClick={(event) => onOpen(item.id, event.currentTarget)}
          className="group h-auto min-h-8 w-fit max-w-full justify-start whitespace-normal px-0! py-1! text-left"
        >
          <span className="line-clamp-2 wrap-anywhere text-sm font-medium">{item.name}</span>
          <Icon
            name="chevron-right"
            className="mt-0.5 size-4 shrink-0 text-kumo-subtle transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </Button>
        <p className="text-sm text-kumo-subtle">
          <span>{scheduleStatus(item)}</span> <span aria-hidden="true">·</span>{" "}
          {scheduleRule(item.schedule, item.timezone)}
        </p>
        {item.lastDispatch ? (
          <p
            className={`wrap-anywhere text-sm ${item.lastDispatch.outcome === "unreachable" || item.lastDispatch.outcome === "rejected" ? "text-kumo-danger" : "text-kumo-subtle"}`}
          >
            <span>
              {m.agents_schedules_last_dispatch()}: {handoffOutcome(item.lastDispatch.outcome)}
            </span>
            {" · "}
            <time
              dateTime={item.lastDispatch.scheduledFor}
              title={formatScheduleTime(item.lastDispatch.scheduledFor, item.timezone)}
            >
              <span aria-hidden="true">{formatSchedulePreviewTime(item.lastDispatch.scheduledFor, item.timezone)}</span>
              <span className="sr-only">{formatScheduleTime(item.lastDispatch.scheduledFor, item.timezone)}</span>
            </time>
          </p>
        ) : null}
      </div>
      {item.nextTriggerAt ? (
        <div className="col-start-1 row-start-2 grid gap-1 @min-[42rem]/content:col-start-2 @min-[42rem]/content:row-start-1">
          <span className="text-xs text-kumo-subtle">{m.agents_schedules_next()}</span>
          <time
            dateTime={item.nextTriggerAt}
            title={formatScheduleTime(item.nextTriggerAt, item.timezone)}
            className="text-sm tabular-nums text-kumo-strong"
          >
            <span aria-hidden="true">{formatSchedulePreviewTime(item.nextTriggerAt, item.timezone)}</span>
            <span className="sr-only">{formatScheduleTime(item.nextTriggerAt, item.timezone)}</span>
          </time>
          <span className="text-xs text-kumo-subtle">{item.timezone}</span>
        </div>
      ) : null}
      <div className="col-start-2 row-start-1 @min-[42rem]/content:col-start-3">
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button
                ref={actionTrigger}
                variant="ghost"
                size="compact"
                shape="square"
                disabled={pendingId !== undefined}
                loading={pending}
                aria-label={m.agents_schedules_actions({ name: item.name })}
              />
            }
          >
            <Icon name="more-vertical" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item onClick={() => onChange(item)}>
              {item.enabled ? m.agents_schedules_pause() : m.agents_schedules_resume()}
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => onDelete(item, actionTrigger.current)}>
              {m.agents_schedules_delete()}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
    </li>
  );
}

function ScheduleRowDetails({
  detail,
  onRetry,
}: {
  detail: { isPending: boolean; isError: boolean; error: Error | null; data?: AgentSchedule };
  onRetry: () => void;
}) {
  if (detail.isPending) return <ScheduleLoading />;
  if (detail.isError) {
    const message =
      detail.error instanceof ApiError && detail.error.status === 404
        ? m.agents_schedules_not_found()
        : m.agents_schedules_detail_error();
    return (
      <div className="grid justify-items-start gap-3">
        <p className="text-sm text-kumo-subtle">{message}</p>
        {!(detail.error instanceof ApiError && detail.error.status === 404) ? (
          <Button variant="secondary" size="compact" onClick={onRetry}>
            {m.common_retry()}
          </Button>
        ) : null}
      </div>
    );
  }
  return detail.data ? <ScheduleDetail schedule={detail.data} /> : null;
}

function ScheduleDeleteDialog({
  item,
  busy,
  error,
  onClose,
  onConfirm,
  returnFocusRef,
}: {
  item?: AgentScheduleListItem;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={item !== undefined}
      busy={busy}
      description={m.agents_schedules_delete_confirm()}
      onClose={onClose}
      role="alertdialog"
      title={item?.name ?? m.agents_schedules_delete()}
      returnFocusRef={returnFocusRef}
      initialFocusRef={cancelRef}
    >
      {error ? (
        <Banner variant="error" role="alert">
          {error}
        </Banner>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button ref={cancelRef} disabled={busy} onClick={onClose} variant="ghost">
          {m.common_cancel()}
        </Button>
        <Button disabled={busy} loading={busy} onClick={onConfirm} variant="danger">
          {m.agents_schedules_delete()}
        </Button>
      </div>
    </Dialog>
  );
}

function summaryOf(schedule: AgentSchedule): AgentScheduleListItem {
  const { prompt: _prompt, detailUrl: _detailUrl, ...summary } = schedule;
  return summary;
}

function scheduleStatus(schedule: AgentScheduleListItem): string {
  if (!schedule.enabled) return m.agents_schedules_paused();
  if (schedule.nextTriggerAt === null) return m.agents_schedules_exhausted();
  return m.agents_schedules_enabled();
}

function scheduleRule(rule: AgentScheduleRule, timezone: string): string {
  if (rule.kind === "at") return m.agents_schedules_at({ time: formatScheduleTime(rule.at, timezone) });
  if (rule.kind === "every") {
    const seconds = rule.intervalSeconds;
    if (seconds % 60 !== 0) return m.agents_schedules_every({ seconds: String(seconds) });
    const unit = seconds % 3600 === 0 ? "hour" : "minute";
    const interval = new Intl.NumberFormat(intlLocale(), { style: "unit", unit, unitDisplay: "long" }).format(
      seconds / (unit === "hour" ? 3600 : 60),
    );
    return m.agents_schedules_interval({ interval });
  }
  return simpleCronLabel(rule.expression) ?? m.agents_schedules_cron({ expression: rule.expression });
}

/** Describe only exact, common wall-clock rules; the Server remains the schedule calculator. */
function simpleCronLabel(expression: string): string | undefined {
  const [minute, hour, day, month, weekday] = expression.trim().split(/\s+/u);
  if (day !== "*" || month !== "*" || !/^\d{1,2}$/u.test(minute ?? "") || !/^\d{1,2}$/u.test(hour ?? "")) return;
  if (Number(minute) > 59 || Number(hour) > 23) return;
  const time = new Intl.DateTimeFormat(intlLocale(), { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(2023, 0, 1, Number(hour), Number(minute))),
  );
  if (weekday === "*") return m.agents_schedules_daily({ time });
  if (weekday === "1-5") return m.agents_schedules_weekdays({ time });
  if (/^[0-6]$/u.test(weekday ?? "")) {
    const day = new Intl.DateTimeFormat(intlLocale(), { weekday: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(2023, 0, 1 + Number(weekday))),
    );
    return m.agents_schedules_weekly({ day, time });
  }
}

function formatSchedulePreviewTime(instant: string, timezone: string): string {
  return new Intl.DateTimeFormat(intlLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(instant));
}

function ScheduleLoading() {
  return (
    <div role="status" className="grid gap-3 py-3">
      <span className="sr-only">{m.common_loading()}</span>
      <SkeletonLine className="w-2/3" />
      <SkeletonLine className="w-1/2" />
      <SkeletonLine className="w-3/4" />
    </div>
  );
}

export function formatScheduleTime(instant: string, timezone: string): string {
  const formatted = new Intl.DateTimeFormat(intlLocale(), {
    dateStyle: "medium",
    timeStyle: "long",
    timeZone: timezone,
  }).format(new Date(instant));
  return `${formatted} (${timezone})`;
}

function ScheduleDetail({ schedule }: { schedule: AgentSchedule }) {
  const last = schedule.lastDispatch;
  const target = schedule.target;
  const targetLabel =
    target.sessionKind === "thread" && target.threadKey
      ? m.agents_schedules_target_thread({
          provider: target.provider,
          channel: target.channelId,
          thread: target.threadKey,
        })
      : m.agents_schedules_target_channel({ provider: target.provider, channel: target.channelId });
  const outcome = last ? handoffOutcome(last.outcome) : m.agents_schedules_no_dispatch();
  return (
    <div className="grid gap-6 text-sm">
      <section className="grid gap-3">
        <Text as="h3" variant="heading" size="lg" headingSize="body">
          {m.agents_schedules_prompt()}
        </Text>
        <p className="whitespace-pre-wrap wrap-anywhere leading-relaxed text-kumo-default">{schedule.prompt}</p>
      </section>
      <dl className="grid gap-4 border-t border-kumo-line pt-5">
        <DetailRow
          label={m.agents_schedules_rule()}
          value={
            schedule.schedule.kind === "cron"
              ? m.agents_schedules_cron({ expression: schedule.schedule.expression })
              : scheduleRule(schedule.schedule, schedule.timezone)
          }
        />
        <DetailRow label={m.agents_schedules_timezone()} value={schedule.timezone} />
        <DetailRow label={m.agents_schedules_target()} value={targetLabel} />
        <DetailRow
          label={m.agents_schedules_next()}
          value={schedule.nextTriggerAt ? formatScheduleTime(schedule.nextTriggerAt, schedule.timezone) : "—"}
        />
        <DetailRow label={m.agents_schedules_last_dispatch()} value={outcome} />
        {last ? (
          <>
            <DetailRow
              label={m.agents_schedules_scheduled_for()}
              value={formatScheduleTime(last.scheduledFor, schedule.timezone)}
            />
            {last.attemptedAt ? (
              <DetailRow
                label={m.agents_schedules_attempted_at()}
                value={formatScheduleTime(last.attemptedAt, schedule.timezone)}
              />
            ) : null}
            {last.code ? <DetailRow label={m.agents_schedules_code()} value={last.code} /> : null}
          </>
        ) : null}
      </dl>
      {last ? (
        <div className="grid gap-2 border-l-2 border-kumo-line pl-3 text-kumo-subtle">
          <p>{handoffExplanation(last.outcome)}</p>
          {last.outcome !== "accepted" ? <p>{m.agents_schedules_no_retry()}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

type HandoffOutcome = NonNullable<AgentScheduleListItem["lastDispatch"]>["outcome"];

function handoffOutcome(outcome: HandoffOutcome): string {
  return {
    accepted: m.agents_schedules_accepted,
    unreachable: m.agents_schedules_unreachable,
    rejected: m.agents_schedules_rejected,
    unknown: m.agents_schedules_unknown,
    skipped: m.agents_schedules_skipped,
  }[outcome]();
}

function handoffExplanation(outcome: HandoffOutcome): string {
  return {
    accepted: m.agents_schedules_accepted_explanation,
    unreachable: m.agents_schedules_unreachable_explanation,
    rejected: m.agents_schedules_rejected_explanation,
    unknown: m.agents_schedules_unknown_explanation,
    skipped: m.agents_schedules_skipped_explanation,
  }[outcome]();
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 @min-[35rem]/content:grid-cols-[10rem_1fr]">
      <dt className="text-kumo-subtle">{label}</dt>
      <dd className="wrap-anywhere text-kumo-default">{value}</dd>
    </div>
  );
}
