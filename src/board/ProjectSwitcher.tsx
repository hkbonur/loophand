import React from "react";
import { PlusIcon } from "@phosphor-icons/react";
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
  }, [name, props.onCreate]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.projects.map((project) => (
        <button
          key={project._id}
          type="button"
          onClick={() => props.onSelect(project._id)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            {
              "border-primary bg-primary/10 text-primary":
                project._id === props.activeProjectId,
              "border-border bg-muted text-muted-foreground hover:text-foreground":
                project._id !== props.activeProjectId,
            },
          )}
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
            className="h-9 rounded-full border border-border bg-muted px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <Button size="sm" onClick={submitNew}>
            Add
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <PlusIcon />
          New project
        </button>
      )}
    </div>
  );
}
