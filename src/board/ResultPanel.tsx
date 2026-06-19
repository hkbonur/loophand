import { Badge } from "../ui/badge";
import { SectionLabel } from "./SectionLabel";
import { outcomeBadge } from "./format";
import type { TaskView } from "./types";

interface Props {
  task: TaskView;
}

export function ResultPanel(props: Props) {
  const task = props.task;
  const badge = task.outcome ? outcomeBadge(task.outcome) : null;

  return (
    <div className="flex flex-col gap-3">
      {badge ? (
        <div>
          <Badge tone={badge.tone}>{`${badge.icon} ${badge.label}`}</Badge>
        </div>
      ) : null}
      <div>
        <SectionLabel>Returns to the agent</SectionLabel>
        <pre className="max-h-64 overflow-auto rounded-2xl border border-border bg-muted p-3 font-mono text-xs text-foreground">
          {JSON.stringify(task.result ?? { status: task.status }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
