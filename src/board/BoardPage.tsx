import React from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Gear } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Spinner } from "../ui/spinner";
import { Empty } from "../ui/empty";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { BoardColumn } from "./BoardColumn";
import { CardDialog } from "./CardDialog";
import { ConnectSnippet } from "./ConnectSnippet";
import { COLUMNS, type TaskView } from "./types";
import { toast } from "../ui/toaster";

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

  const tasks = useQuery(api.tasks.list, activeProjectId ? { projectId: activeProjectId } : "skip");

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="island-kicker mb-1">loophand</p>
          <h1 className="text-2xl font-bold text-foreground">Board</h1>
        </div>
        <Link
          to="/settings/agents"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground no-underline transition hover:bg-card"
        >
          <Gear className="h-4 w-4" />
          Agents
        </Link>
      </div>

      <div className="mb-6">
        <ProjectSwitcher
          projects={projects}
          activeProjectId={activeProjectId}
          onSelect={setActiveProjectId}
          onCreate={onCreateProject}
        />
      </div>

      {tasks !== undefined && tasks.length === 0 ? (
        <Empty
          title="Waiting for your first task"
          description="Connect an agent with the snippet below. The moment it calls create_task, a card appears here — live."
        >
          <div className="mt-4">
            <ConnectSnippet />
          </div>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((column) => (
            <BoardColumn
              key={column.status}
              column={column}
              tasks={(tasks ?? []).filter((task: TaskView) => task.status === column.status)}
              now={now}
              onOpen={setSelectedTaskId}
            />
          ))}
        </div>
      )}

      {selectedTaskId ? (
        <CardDialog taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      ) : null}
    </main>
  );
}
