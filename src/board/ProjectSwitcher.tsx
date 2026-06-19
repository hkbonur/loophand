import React from "react";
import { Plus } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "../ui/button";
import type { ProjectSummary } from "./types";

interface Props {
  projects: ProjectSummary[];
  activeProjectId: ProjectSummary["_id"] | null;
  onSelect: (projectId: ProjectSummary["_id"]) => void;
  onCreate: (name: string) => void;
}

export function ProjectSwitcher(props: Props) {
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");

  const submitNew = React.useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    props.onCreate(trimmed);
    setName("");
    setCreating(false);
  }, [name, props]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.projects.map((project) => (
        <button
          key={project._id}
          type="button"
          onClick={() => props.onSelect(project._id)}
          className={cn("rounded-full border px-3 py-1.5 text-sm font-medium transition", {
            "border-[var(--lagoon-deep)] bg-[rgba(79,184,178,0.16)] text-[var(--lagoon-deep)]":
              project._id === props.activeProjectId,
            "border-[var(--line)] bg-[var(--surface)] text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]":
              project._id !== props.activeProjectId,
          })}
        >
          {project.name}
        </button>
      ))}

      {creating ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitNew();
              if (event.key === "Escape") setCreating(false);
            }}
            placeholder="Project name"
            className="h-9 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--sea-ink)] focus:border-[var(--lagoon-deep)] focus:outline-none"
          />
          <Button size="sm" onClick={submitNew}>
            Add
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--line)] px-3 py-1.5 text-sm text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]"
        >
          <Plus className="h-3.5 w-3.5" />
          New project
        </button>
      )}
    </div>
  );
}
