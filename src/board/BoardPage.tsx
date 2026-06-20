import React from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { GearIcon, ClockIcon, SlidersIcon } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Spinner } from "../ui/spinner";
import { Empty } from "../ui/empty";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { BoardColumn } from "./BoardColumn";
import { BoardFilters } from "./BoardFilters";
import { BlockedLane } from "./BlockedLane";
import { CardDialog } from "./CardDialog";
import { ConnectSnippet } from "./ConnectSnippet";
import { COLUMNS, type TaskView } from "./types";
import { useAgents } from "./useAgents";
import { useBoardFilters } from "./useBoardFilters";
import { keyToNavCommand, moveFocus, type Focus } from "./keyboard/boardKeymap";
import { TASK_TYPES } from "../../convex/lib/taskConstants";
import { toast } from "../ui/toaster";
import { PushPrompt } from "../pwa/PushPrompt";

function CenteredSpinner(props: { label: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Spinner />
      {props.label}
    </div>
  );
}

export function BoardPage() {
  const ensureUser = useMutation(api.users.ensureUser);
  const ensureDefault = useMutation(api.projects.ensureDefault);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      await ensureUser({});
      await ensureDefault({});
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [ensureUser, ensureDefault]);

  if (!ready) return <CenteredSpinner label="Setting up your board…" />;
  return <BoardInner />;
}

function BoardInner() {
  const projects = useQuery(api.projects.list, {});
  const createProject = useMutation(api.projects.create);
  const [activeProjectId, setActiveProjectId] = React.useState<Id<"projects"> | null>(null);
  const [selectedTaskId, setSelectedTaskId] = React.useState<Id<"tasks"> | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (!projects || projects.length === 0) return;
    setActiveProjectId((current) => current ?? projects[0]._id);
  }, [projects]);

  // Open a card deep-linked from a push notification (/?task=<id>), then clean
  // the URL so a refresh doesn't reopen it.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const taskParam = new URLSearchParams(window.location.search).get("task");
    if (!taskParam) return;
    setSelectedTaskId(taskParam as Id<"tasks">);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const tasks = useQuery(api.tasks.list, activeProjectId ? { projectId: activeProjectId } : "skip");
  const agents = useAgents();
  const { filter, setFilter, tagOptions, agentOptions, visibleTasks } = useBoardFilters(
    tasks,
    agents,
    activeProjectId,
  );

  // Keyboard navigation: focus a card by {col,row} over the visible columns and
  // open it with o/Enter. Disabled while a dialog or a text field has focus.
  const columns = React.useMemo(
    () => COLUMNS.map((column) => (visibleTasks ?? []).filter((t) => t.status === column.status)),
    [visibleTasks],
  );
  const [focus, setFocus] = React.useState<Focus | null>(null);
  const focusedTaskId = focus ? (columns[focus.col]?.[focus.row]?._id ?? null) : null;

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (selectedTaskId) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const command = keyToNavCommand(event.key);
      if (!command) return;
      event.preventDefault();
      if (command === "open") {
        if (focusedTaskId) setSelectedTaskId(focusedTaskId);
        return;
      }
      setFocus((current) => moveFocus(columns.map((c) => c.length), current, command));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedTaskId, focusedTaskId, columns]);

  const onCreateProject = React.useCallback(
    async (name: string) => {
      try {
        const id = await createProject({ name });
        setActiveProjectId(id);
      } catch {
        toast.error("Could not create the project.");
      }
    },
    [createProject],
  );

  if (projects === undefined) return <CenteredSpinner label="Loading projects…" />;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6 pr-24">
        <p className="island-kicker mb-1">loophand</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Board</h1>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ProjectSwitcher
            projects={projects}
            activeProjectId={activeProjectId}
            onSelect={setActiveProjectId}
            onCreate={onCreateProject}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/settings/preferences"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground no-underline transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <SlidersIcon className="h-4 w-4" />
            Rules
          </Link>
          <Link
            to="/settings/schedules"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground no-underline transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <ClockIcon className="h-4 w-4" />
            Schedules
          </Link>
          <Link
            to="/settings/agents"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground no-underline transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <GearIcon className="h-4 w-4" />
            Agents
          </Link>
        </div>
      </div>

      <PushPrompt />

      {tasks !== undefined && tasks.length === 0 ? (
        <Empty
          icon={
            <span className="block h-2.5 w-2.5 rounded-full bg-primary motion-safe:animate-pulse" />
          }
          title="Waiting for your first task"
          description="Connect an agent with the snippet below. The moment it calls create_task, a card appears here, live."
        >
          <div className="mt-4 w-full min-w-0">
            <ConnectSnippet />
          </div>
        </Empty>
      ) : (
        <>
          {tasks && tasks.length > 0 ? (
            <div className="mb-4">
              <BoardFilters
                tags={tagOptions}
                agents={agentOptions}
                types={[...TASK_TYPES]}
                value={filter}
                onChange={setFilter}
              />
            </div>
          ) : null}
          <BlockedLane
            tasks={(visibleTasks ?? []).filter((task: TaskView) => task.status === "blocked")}
            now={now}
            agents={agents}
            onOpen={setSelectedTaskId}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((column, index) => (
              <BoardColumn
                key={column.status}
                column={column}
                tasks={columns[index]}
                now={now}
                agents={agents}
                loading={tasks === undefined}
                onOpen={setSelectedTaskId}
                focusedTaskId={focusedTaskId}
              />
            ))}
          </div>
        </>
      )}

      {selectedTaskId ? (
        <CardDialog
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onOpenTask={setSelectedTaskId}
        />
      ) : null}
    </main>
  );
}
